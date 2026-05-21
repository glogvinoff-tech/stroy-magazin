from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import SupportThread, SupportMessage, User, Role
from datetime import datetime
from urllib import request as urlrequest
from urllib.error import HTTPError
from urllib.parse import urlencode
import base64
import json
import os
from pathlib import Path
import ssl
import time
import uuid

router = APIRouter(prefix="/api/ai", tags=["ai"])


class AiReplyOptions(BaseModel):
    temperature: float | None = None


_token_cache = {"token": None, "expires_at": 0}
_PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _resolve_fs_path(value: str) -> str:
    p = Path(value)
    if not p.is_absolute():
        p = _PROJECT_ROOT / p
    return str(p)


def _looks_like_uuid(value: str) -> bool:
    try:
        uuid.UUID((value or "").strip())
        return True
    except Exception:
        return False


def _looks_like_base64_uuid_pair(value: str) -> bool:
    try:
        decoded = base64.b64decode((value or "").strip(), validate=True).decode("utf-8")
    except Exception:
        return False
    if ":" not in decoded:
        return False
    left, right = decoded.split(":", 1)
    return _looks_like_uuid(left) and _looks_like_uuid(right)


def _format_gigachat_urlopen_error(e: Exception) -> str:
    msg = str(e)
    if "CERTIFICATE_VERIFY_FAILED" in msg or "certificate verify failed" in msg:
        ca_file = (os.getenv("GIGACHAT_CA_FILE") or "").strip()
        verify = (os.getenv("GIGACHAT_VERIFY_SSL") or "1").strip()
        ca_note = f"GIGACHAT_CA_FILE={ca_file}" if ca_file else "GIGACHAT_CA_FILE is not set"
        return (
            "SSL verify failed while calling GigaChat. "
            "Fix: provide a trusted CA bundle (set GIGACHAT_CA_FILE to a PEM file), "
            "or (dev only) disable verification via GIGACHAT_VERIFY_SSL=0. "
            f"Current: GIGACHAT_VERIFY_SSL={verify}, {ca_note}. "
            f"Original error: {msg}"
        )
    if "HTTP Error 401" in msg or "HTTP Error 403" in msg:
        return (
            f"{msg}. "
            "Check credentials: "
            "GIGACHAT_ACCESS_TOKEN must be an OAuth access_token (short-lived), "
            "while GIGACHAT_AUTHORIZATION_KEY is base64(client_id:client_secret)."
        )
    return msg


def _now_ts() -> int:
    return int(time.time())


def _is_admin(user: User, db: Session) -> bool:
    try:
        if getattr(user, "role", None) and getattr(user.role, "name", None) == "admin":
            return True
    except Exception:
        pass
    if getattr(user, "role_id", None):
        role = db.query(Role).filter(Role.id == user.role_id).first()
        if getattr(role, "name", None) == "admin":
            return True
    return False


def _ssl_context() -> ssl.SSLContext:
    verify = (os.getenv("GIGACHAT_VERIFY_SSL") or "1").strip().lower()
    ctx = ssl.create_default_context()
    if verify in {"0", "false", "no", "off"}:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx

    cafile = (os.getenv("GIGACHAT_CA_FILE") or "").strip()
    if cafile:
        for part in [p.strip() for p in cafile.replace(";", ",").split(",") if p.strip()]:
            cafile_resolved = _resolve_fs_path(part)
            if not Path(cafile_resolved).exists():
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"GigaChat SSL: CA file not found: {cafile_resolved}",
                )
            try:
                ctx.load_verify_locations(cafile=cafile_resolved)
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"GigaChat SSL: could not load CA file: {e}",
                )

    # Add certifi bundle (helps on systems with missing/old CA store).
    try:
        import certifi  # type: ignore

        ctx.load_verify_locations(cafile=certifi.where())
    except Exception:
        pass

    return ctx


def _gigachat_get_token(force_refresh: bool = False) -> str:
    token_env = (os.getenv("GIGACHAT_ACCESS_TOKEN") or "").strip()

    # If the base64(client_id:client_secret) authorization key is mistakenly placed
    # into GIGACHAT_ACCESS_TOKEN, do not treat it as a Bearer token.
    token_env_is_basic = bool(token_env and _looks_like_base64_uuid_pair(token_env))
    if token_env and not token_env_is_basic:
        return token_env

    if not force_refresh:
        cached = _token_cache.get("token")
        exp = int(_token_cache.get("expires_at") or 0)
        if cached and exp > _now_ts() + 15:
            return cached

    authorization_key = (os.getenv("GIGACHAT_AUTHORIZATION_KEY") or "").strip()
    if not authorization_key and token_env_is_basic:
        authorization_key = token_env
    if authorization_key.lower().startswith("basic "):
        authorization_key = authorization_key[6:].strip()

    client_id = (os.getenv("GIGACHAT_CLIENT_ID") or "").strip()
    client_secret = (os.getenv("GIGACHAT_CLIENT_SECRET") or "").strip()
    if not authorization_key and (not client_id or not client_secret):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GigaChat не настроен: укажи GIGACHAT_ACCESS_TOKEN или GIGACHAT_AUTHORIZATION_KEY или GIGACHAT_CLIENT_ID/GIGACHAT_CLIENT_SECRET",
        )

    oauth_url = (os.getenv("GIGACHAT_OAUTH_URL") or "https://ngw.devices.sberbank.ru:9443/api/v2/oauth").strip()
    scope = (os.getenv("GIGACHAT_SCOPE") or "GIGACHAT_API_PERS").strip()

    basic = authorization_key or base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("ascii")
    headers = {
        "Authorization": f"Basic {basic}",
        "RqUID": str(uuid.uuid4()),
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
    }
    body = urlencode({"scope": scope}).encode("utf-8")

    req = urlrequest.Request(oauth_url, data=body, headers=headers, method="POST")
    try:
        with urlrequest.urlopen(req, timeout=25, context=_ssl_context()) as resp:
            raw = resp.read().decode("utf-8")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GigaChat token error: {_format_gigachat_urlopen_error(e)}",
        )

    try:
        data = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="GigaChat token: invalid JSON response")

    token = data.get("access_token") or data.get("accessToken") or data.get("token")
    expires_at = data.get("expires_at") or data.get("expiresAt") or 0
    if not token:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="GigaChat token: access_token missing")

    exp_ts = 0
    try:
        exp_ts = int(expires_at)
        if exp_ts > 10**12:  # ms
            exp_ts = exp_ts // 1000
    except Exception:
        exp_ts = 0

    if not exp_ts:
        try:
            exp_ts = _now_ts() + int(data.get("expires_in") or 3500)
        except Exception:
            exp_ts = _now_ts() + 3500

    _token_cache["token"] = token
    _token_cache["expires_at"] = exp_ts
    return token


def _extract_content(payload: dict) -> str:
    try:
        choices = payload.get("choices") or []
        if choices:
            msg = choices[0].get("message") or {}
            content = msg.get("content")
            if isinstance(content, str) and content.strip():
                return content.strip()
            text = choices[0].get("text")
            if isinstance(text, str) and text.strip():
                return text.strip()
    except Exception:
        pass
    return ""


def _gigachat_chat(messages: list[dict], temperature: float | None = None) -> str:
    api_url = (os.getenv("GIGACHAT_API_URL") or "https://gigachat.devices.sberbank.ru/api/v1/chat/completions").strip()
    model = (os.getenv("GIGACHAT_MODEL") or "GigaChat").strip()
    token = _gigachat_get_token()

    req_payload = {
        "model": model,
        "messages": messages,
        "stream": False,
    }
    if temperature is not None:
        try:
            req_payload["temperature"] = float(temperature)
        except Exception:
            pass

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    data = json.dumps(req_payload, ensure_ascii=False).encode("utf-8")
    try:
        req = urlrequest.Request(api_url, data=data, headers=headers, method="POST")
        with urlrequest.urlopen(req, timeout=35, context=_ssl_context()) as resp:
            raw = resp.read().decode("utf-8")
    except HTTPError as e:
        token_env = (os.getenv("GIGACHAT_ACCESS_TOKEN") or "").strip()
        using_static_token = bool(token_env and not _looks_like_base64_uuid_pair(token_env))
        if getattr(e, "code", None) == 401 and not using_static_token:
            _token_cache["token"] = None
            _token_cache["expires_at"] = 0
            token2 = _gigachat_get_token(force_refresh=True)
            headers["Authorization"] = f"Bearer {token2}"
            try:
                req2 = urlrequest.Request(api_url, data=data, headers=headers, method="POST")
                with urlrequest.urlopen(req2, timeout=35, context=_ssl_context()) as resp:
                    raw = resp.read().decode("utf-8")
            except Exception as e2:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"GigaChat request error: {_format_gigachat_urlopen_error(e2)}",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GigaChat request error: {_format_gigachat_urlopen_error(e)}",
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GigaChat request error: {_format_gigachat_urlopen_error(e)}",
        )

    try:
        payload = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="GigaChat: invalid JSON response")

    content = _extract_content(payload)
    if not content:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="GigaChat: empty response")
    return content


def _mock_chat(messages: list[dict]) -> str:
    last_user = ""
    for m in reversed(messages or []):
        if m.get("role") == "user":
            last_user = (m.get("content") or "").strip()
            break
    if not last_user:
        return "Опиши, пожалуйста, что нужно: заказ, каталог, PRO или мероприятие — помогу."
    return (
        "Я вижу запрос:\n"
        f"«{last_user}»\n\n"
        "Если хочешь — уточни строительный магазин, дату/время и сколько позиций. "
        "Для заказа нескольких товаров включи PRO в профиле."
    )


def _ai_chat(messages: list[dict], temperature: float | None = None) -> str:
    provider = (os.getenv("AI_PROVIDER") or "mock").strip().lower()
    if provider == "gigachat":
        return _gigachat_chat(messages, temperature=temperature)
    return _mock_chat(messages)


def _support_system_prompt(is_pro: bool) -> str:
    base = (os.getenv("AI_SUPPORT_SYSTEM_PROMPT") or "").strip()
    if base:
        return base
    vip = "Пользователь PRO (VIP)." if is_pro else "Пользователь без PRO."
    return (
        "Ты — ассистент службы поддержки строительного магазина и приложения заказов. "
        "Отвечай на русском, коротко и по делу. "
        "Помогай с заказм товаров, каталог, мероприятиями, профилем и подпиской PRO. "
        "Если данных не хватает — задай 1-2 уточняющих вопроса. "
        "Не выдумывай факты. "
        f"{vip}"
    )


def _thread_messages_for_ai(db: Session, thread_id: int, limit: int = 30) -> list[dict]:
    msgs = (
        db.query(SupportMessage)
        .filter(SupportMessage.thread_id == thread_id)
        .order_by(SupportMessage.created_at.asc())
        .all()
    )
    if limit and len(msgs) > limit:
        msgs = msgs[-limit:]
    out = []
    for m in msgs:
        role = "user" if (m.sender_role or "") == "user" else "assistant"
        out.append({"role": role, "content": m.text or ""})
    return out


def _message_payload(msg: SupportMessage) -> dict:
    return {
        "id": msg.id,
        "thread_id": msg.thread_id,
        "sender_role": msg.sender_role,
        "sender_user_id": msg.sender_user_id,
        "text": msg.text,
        "created_at": msg.created_at,
    }


@router.post("/support/thread/{thread_id}/reply")
def ai_reply_for_user(thread_id: int, user_id: int, options: AiReplyOptions | None = None, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    thread = db.query(SupportThread).filter(SupportThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    if thread.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    temperature = None
    if options and options.temperature is not None:
        temperature = options.temperature

    msgs = [{"role": "system", "content": _support_system_prompt(bool(getattr(user, "is_pro", False)))}]
    msgs.extend(_thread_messages_for_ai(db, thread_id))
    reply = _ai_chat(msgs, temperature=temperature)

    saved = SupportMessage(thread_id=thread_id, sender_role="assistant", sender_user_id=None, text=reply)
    thread.last_message_at = datetime.utcnow()
    db.add(saved)
    db.add(thread)
    db.commit()
    db.refresh(saved)
    return _message_payload(saved)


@router.post("/admin/thread/{thread_id}/reply")
def ai_reply_for_admin(thread_id: int, admin_id: int, options: AiReplyOptions | None = None, db: Session = Depends(get_db)):
    admin = db.query(User).filter(User.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not _is_admin(admin, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    thread = db.query(SupportThread).filter(SupportThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    user = db.query(User).filter(User.id == thread.user_id).first()
    temperature = None
    if options and options.temperature is not None:
        temperature = options.temperature

    msgs = [{"role": "system", "content": _support_system_prompt(bool(getattr(user, "is_pro", False)) if user else False)}]
    msgs.extend(_thread_messages_for_ai(db, thread_id))
    reply = _ai_chat(msgs, temperature=temperature)

    saved = SupportMessage(thread_id=thread_id, sender_role="assistant", sender_user_id=None, text=reply)
    thread.last_message_at = datetime.utcnow()
    db.add(saved)
    db.add(thread)
    db.commit()
    db.refresh(saved)
    return _message_payload(saved)
