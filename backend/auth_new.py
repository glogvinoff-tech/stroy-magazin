from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func
from database import get_db
from models import User, Role, Basket, EmailVerificationCode
from schemas import UserResponse
from utils import hash_password, verify_password
from pydantic import BaseModel, EmailStr
from typing import Optional
import os
import json
import random
import smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta, timezone
from urllib import request as urlrequest
from urllib.parse import urlencode

router = APIRouter(prefix="/api/auth", tags=["authentication"])


class RegisterPayload(BaseModel):
    name: str
    password: str
    role_id: int = 1
    email: Optional[EmailStr] = None


class LoginPayload(BaseModel):
    name: str
    password: str


class GoogleAuthCode(BaseModel):
    code: str


class VkAuthCode(BaseModel):
    code: str
    redirect_uri: str


class VkIdLoginPayload(BaseModel):
    access_token: str
    user_id: str
    email: Optional[EmailStr] = None


class LinkVkPayload(VkAuthCode):
    user_id: int


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    birth_date: Optional[str] = None


class EmailCodeRequest(BaseModel):
    user_id: int
    email: EmailStr


class EmailCodeConfirm(BaseModel):
    user_id: int
    code: str


class ProStatusUpdate(BaseModel):
    enabled: bool = True


def _user_columns() -> set:
    return set(User.__table__.columns.keys())


def _has(col: str) -> bool:
    return col in _user_columns()


def _resolve_default_role_id(db: Session) -> int:
    default_role = db.query(Role).filter(Role.id == 1).first() or db.query(Role).first()
    if not default_role:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Role not found")
    return default_role.id


def _public_user_payload(db_user, message: str) -> dict:
    display_name = getattr(db_user, "name", None) or getattr(db_user, "username", None) or getattr(db_user, "email", None) or "user"
    role_id = getattr(db_user, "role_id", None) or 1
    registration_date = getattr(db_user, "registration_date", None) or getattr(db_user, "created_at", None) or datetime.utcnow()
    avatar = getattr(db_user, "vk_avatar_url", None)
    return {
        "id": db_user.id,
        "name": display_name,
        "role_id": role_id,
        "registration_date": registration_date,
        "is_pro": bool(getattr(db_user, "is_pro", False)),
        "message": message,
        "avatar_url": avatar,
    }


def _profile_payload(db_user) -> dict:
    email_verified = bool(getattr(db_user, "email_verified", False))
    email = getattr(db_user, "email", None) or ""
    # hide placeholder emails used for legacy NOT NULL / UNIQUE constraints
    if email and (email.endswith(".local") or email.endswith("@local")) and not email_verified:
        email = ""
    return {
        "id": db_user.id,
        "name": getattr(db_user, "name", None) or getattr(db_user, "username", None) or "",
        "full_name": getattr(db_user, "full_name", None) or "",
        "phone": getattr(db_user, "phone", None) or "",
        "birth_date": getattr(db_user, "birth_date", None) or "",
        "email": email,
        "email_verified": email_verified,
        "is_pro": bool(getattr(db_user, "is_pro", False)),
        "vk_username": getattr(db_user, "vk_username", None) or "",
        "vk_avatar_url": getattr(db_user, "vk_avatar_url", None) or "",
    }


def _create_user_if_needed(db: Session, payload: dict) -> User:
    user = User(**payload)
    db.add(user)
    db.flush()
    if "user_id" in set(Basket.__table__.columns.keys()):
        existing_basket = db.query(Basket).filter(Basket.user_id == user.id).first()
        if not existing_basket:
            db.add(Basket(user_id=user.id))
    db.commit()
    db.refresh(user)
    return user


def _build_local_payload(db: Session, name: str, password: str, role_id: int, email: Optional[str]) -> dict:
    cols = _user_columns()
    payload = {}
    cleaned = (name or "").strip()
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")

    hashed = hash_password(password)
    if "name" in cols:
        payload["name"] = cleaned
    if "username" in cols:
        payload["username"] = cleaned
    if "password" in cols:
        payload["password"] = hashed
    if "hashed_password" in cols:
        payload["hashed_password"] = hashed
    if "role_id" in cols:
        payload["role_id"] = role_id if role_id else _resolve_default_role_id(db)
    if "email" in cols:
        payload["email"] = str(email) if email else f"user_{os.urandom(8).hex()}@local"
    if "email_verified" in cols:
        payload["email_verified"] = False
    if "is_active" in cols:
        payload["is_active"] = True
    return payload


def _find_user_for_login(db: Session, login_value: str):
    value = (login_value or "").strip()
    if not value:
        return None
    cols = _user_columns()
    if "name" in cols:
        user = db.query(User).filter(User.name == value).first()
        if user:
            return user
    if "username" in cols:
        user = db.query(User).filter(User.username == value).first()
        if user:
            return user
    if "email" in cols:
        user = db.query(User).filter(
            sa_func.lower(User.email) == value.lower(),
            User.email_verified == True,  # noqa: E712
        ).first()
        if user:
            return user
    return None


def _verify_user_password(db_user, raw_password: str) -> bool:
    if hasattr(db_user, "password") and getattr(db_user, "password", None):
        return verify_password(raw_password, db_user.password)
    if hasattr(db_user, "hashed_password") and getattr(db_user, "hashed_password", None):
        return verify_password(raw_password, db_user.hashed_password)
    return False


def _find_google_user(db: Session, email: Optional[str], username: str):
    cols = _user_columns()
    if "email" in cols and email:
        user = db.query(User).filter(User.email == email).first()
        if user:
            return user
    if "name" in cols:
        user = db.query(User).filter(User.name == username).first()
        if user:
            return user
    if "username" in cols:
        user = db.query(User).filter(User.username == username).first()
        if user:
            return user
    return None


def _build_google_payload(db: Session, email: Optional[str], username: str, display_name: str) -> dict:
    cols = _user_columns()
    payload = {}
    random_password = hash_password(os.urandom(16).hex())
    if "name" in cols:
        payload["name"] = username
    if "username" in cols:
        payload["username"] = username
    if "password" in cols:
        payload["password"] = random_password
    if "hashed_password" in cols:
        payload["hashed_password"] = random_password
    if "role_id" in cols:
        payload["role_id"] = _resolve_default_role_id(db)
    if "full_name" in cols:
        payload["full_name"] = display_name
    if "email" in cols:
        payload["email"] = email or f"{username}@google.local"
    if "email_verified" in cols:
        payload["email_verified"] = bool(email)
    if "is_active" in cols:
        payload["is_active"] = True
    return payload


def _vk_birth_to_iso(bdate: str) -> str:
    value = (bdate or "").strip()
    if not value:
        return ""
    parts = value.split(".")
    if len(parts) == 3:
        dd, mm, yyyy = parts
        if len(yyyy) == 4:
            return f"{yyyy}-{mm.zfill(2)}-{dd.zfill(2)}"
    return ""


def _build_vk_payload(db: Session, vk_user: dict, email: Optional[str]) -> dict:
    cols = _user_columns()
    payload = {}
    vk_id = str(vk_user.get("id") or "")
    screen_name = (vk_user.get("screen_name") or vk_user.get("domain") or f"vk_{vk_id}").strip()
    display_name = " ".join([x for x in [(vk_user.get("first_name") or "").strip(), (vk_user.get("last_name") or "").strip()] if x]).strip() or screen_name
    random_password = hash_password(os.urandom(16).hex())

    if "name" in cols:
        payload["name"] = screen_name
    if "username" in cols:
        payload["username"] = screen_name
    if "password" in cols:
        payload["password"] = random_password
    if "hashed_password" in cols:
        payload["hashed_password"] = random_password
    if "role_id" in cols:
        payload["role_id"] = _resolve_default_role_id(db)
    if "full_name" in cols:
        payload["full_name"] = display_name
    if "email" in cols:
        payload["email"] = email or f"{screen_name}@vk.local"
    if "email_verified" in cols:
        payload["email_verified"] = bool(email)
    if "vk_id" in cols:
        payload["vk_id"] = vk_id
    if "vk_username" in cols:
        payload["vk_username"] = screen_name
    if "vk_avatar_url" in cols:
        payload["vk_avatar_url"] = (vk_user.get("photo_200") or vk_user.get("photo_max") or "").strip()
    if "birth_date" in cols:
        payload["birth_date"] = _vk_birth_to_iso(vk_user.get("bdate", ""))
    if "is_active" in cols:
        payload["is_active"] = True
    return payload


def _exchange_google_code(code: str) -> dict:
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000/auth/google/callback")
    if not client_id or not client_secret:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Google is not configured")

    body = urlencode({
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }).encode("utf-8")
    req = urlrequest.Request(
        "https://oauth2.googleapis.com/token",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urlrequest.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not exchange Google code")


def _google_userinfo(access_token: str) -> dict:
    req = urlrequest.Request(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        method="GET",
    )
    try:
        with urlrequest.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not fetch Google user info")


def _exchange_vk_code(code: str, redirect_uri: str) -> dict:
    client_id = os.getenv("VK_CLIENT_ID")
    client_secret = os.getenv("VK_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="VK is not configured")
    qs = urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "code": code,
    })
    url = f"https://oauth.vk.com/access_token?{qs}"
    try:
        with urlrequest.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("error"):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"VK auth error: {data.get('error_description', data['error'])}")
            return data
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not exchange VK code")


def _vk_userinfo(access_token: str, vk_user_id: str) -> dict:
    qs = urlencode({
        "user_ids": vk_user_id,
        "v": "5.199",
        "fields": "bdate,photo_200,screen_name,domain",
        "access_token": access_token,
    })
    url = f"https://api.vk.com/method/users.get?{qs}"
    try:
        with urlrequest.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("error"):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"VK user info error: {data['error'].get('error_msg', 'unknown')}")
            users = data.get("response") or []
            if not users:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="VK user info is empty")
            return users[0]
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not fetch VK user info")


def _send_email_verification_code(email: str, code: str) -> None:
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    sender = os.getenv("SMTP_FROM", user or "noreply@example.com")
    if not host or not user or not password:
        if (os.getenv("EMAIL_CODE_DEV_MODE") or "1").strip().lower() in {"1", "true", "yes", "on"}:
            print(f"[email verification] code for {email}: {code}")
            return
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="SMTP is not configured")

    msg = EmailMessage()
    msg["Subject"] = "Код подтверждения email"
    msg["From"] = sender
    msg["To"] = email
    msg.set_content(
        "Здравствуйте!\n\n"
        f"Ваш код подтверждения email: {code}\n"
        "Код действует 10 минут.\n\n"
        "Если вы не запрашивали код, просто проигнорируйте это письмо.\n"
        "Строительный магазин"
    )

    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=10) as smtp:
                smtp.login(user, password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=10) as smtp:
                smtp.starttls()
                smtp.login(user, password)
                smtp.send_message(msg)
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not send verification email")


@router.get("/public-config")
def auth_public_config():
    google_client_id = (os.getenv("GOOGLE_CLIENT_ID") or os.getenv("REACT_APP_GOOGLE_CLIENT_ID") or "").strip()
    vk_client_id = (os.getenv("VK_CLIENT_ID") or os.getenv("REACT_APP_VK_CLIENT_ID") or "").strip()
    return {
        "google_client_id": google_client_id,
        "vk_client_id": vk_client_id,
    }


@router.post("/register", response_model=UserResponse)
def register(payload: RegisterPayload, db: Session = Depends(get_db)):
    existing = _find_user_for_login(db, payload.name)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")
    if _has("email") and payload.email:
        email_taken = db.query(User).filter(User.email == payload.email).first()
        if email_taken:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    if _has("role_id"):
        role = db.query(Role).filter(Role.id == 1).first()
        if not role:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Default role not found")

    user = _create_user_if_needed(db, _build_local_payload(db, payload.name, payload.password, 1, payload.email))
    return _public_user_payload(user, "Registration successful")


@router.post("/login")
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    user = _find_user_for_login(db, payload.name)
    if not user or not _verify_user_password(user, payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return _public_user_payload(user, "Login successful")


@router.post("/google/callback")
def google_callback(payload: GoogleAuthCode, db: Session = Depends(get_db)):
    token_data = _exchange_google_code(payload.code)
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No access_token from Google")
    info = _google_userinfo(access_token)
    email = info.get("email")
    sub = info.get("sub", "")
    username = email or f"google_{sub}"
    display_name = info.get("name") or username
    user = _find_google_user(db, email=email, username=username)
    if not user:
        user = _create_user_if_needed(db, _build_google_payload(db, email, username, display_name))
    return _public_user_payload(user, "Google login successful")


@router.post("/vk/callback")
def vk_callback(payload: VkAuthCode, db: Session = Depends(get_db)):
    token = _exchange_vk_code(payload.code, payload.redirect_uri)
    access_token = token.get("access_token")
    vk_user_id = str(token.get("user_id", ""))
    email = token.get("email")
    if not access_token or not vk_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="VK token payload is invalid")
    vk_user = _vk_userinfo(access_token, vk_user_id)
    cols = _user_columns()
    user = None
    if "vk_id" in cols:
        user = db.query(User).filter(User.vk_id == vk_user_id).first()
    if not user and email and "email" in cols:
        user = db.query(User).filter(User.email == email).first()
    if not user:
        user = _create_user_if_needed(db, _build_vk_payload(db, vk_user, email))
    return _public_user_payload(user, "VK login successful")


@router.post("/vkid/login")
def vkid_login(payload: VkIdLoginPayload, db: Session = Depends(get_db)):
    access_token = (payload.access_token or "").strip()
    vk_user_id = str(payload.user_id or "").strip()
    if not access_token or not vk_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="VKID token payload is invalid")

    vk_user = _vk_userinfo(access_token, vk_user_id)
    cols = _user_columns()
    user = None
    if "vk_id" in cols:
        user = db.query(User).filter(User.vk_id == vk_user_id).first()
    if not user and payload.email and "email" in cols:
        user = db.query(User).filter(User.email == str(payload.email)).first()
    if not user:
        user = _create_user_if_needed(db, _build_vk_payload(db, vk_user, str(payload.email) if payload.email else None))
    return _public_user_payload(user, "VKID login successful")


@router.post("/vk/link")
def link_vk(payload: LinkVkPayload, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    token = _exchange_vk_code(payload.code, payload.redirect_uri)
    access_token = token.get("access_token")
    vk_user_id = str(token.get("user_id", ""))
    if not access_token or not vk_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="VK token payload is invalid")

    if _has("vk_id"):
        existing = db.query(User).filter(User.vk_id == vk_user_id, User.id != payload.user_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="VK account already linked to another user")

    vk_user = _vk_userinfo(access_token, vk_user_id)
    if _has("vk_id"):
        user.vk_id = vk_user_id
    if _has("vk_username"):
        user.vk_username = (vk_user.get("screen_name") or vk_user.get("domain") or "").strip()
    if _has("vk_avatar_url"):
        user.vk_avatar_url = (vk_user.get("photo_200") or "").strip()
    if _has("birth_date") and not user.birth_date:
        user.birth_date = _vk_birth_to_iso(vk_user.get("bdate", ""))
    db.add(user)
    db.commit()
    db.refresh(user)
    return _profile_payload(user)


@router.post("/email/send-code")
def send_email_code(payload: EmailCodeRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    email_value = str(payload.email).strip().lower()
    existing = db.query(User).filter(sa_func.lower(User.email) == email_value, User.id != payload.user_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    code = f"{random.randint(0, 999999):06d}"
    expires_at = datetime.now(tz=timezone.utc) + timedelta(minutes=10)
    rec = EmailVerificationCode(
        user_id=payload.user_id,
        email=email_value,
        code=code,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(rec)
    db.commit()
    _send_email_verification_code(str(payload.email), code)
    return {"message": "Verification code sent"}


@router.post("/email/confirm")
def confirm_email_code(payload: EmailCodeConfirm, db: Session = Depends(get_db)):
    now = datetime.now(tz=timezone.utc)
    rec = (
        db.query(EmailVerificationCode)
        .filter(
            EmailVerificationCode.user_id == payload.user_id,
            EmailVerificationCode.code == payload.code.strip(),
            EmailVerificationCode.is_used == False,  # noqa: E712
        )
        .order_by(EmailVerificationCode.created_at.desc())
        .first()
    )
    if not rec:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification code")
    if rec.expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification code expired")

    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    existing = db.query(User).filter(sa_func.lower(User.email) == rec.email.lower(), User.id != payload.user_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    if _has("email"):
        user.email = rec.email
    if _has("email_verified"):
        user.email_verified = True
    rec.is_used = True
    db.add(user)
    db.add(rec)
    db.commit()
    db.refresh(user)
    return _profile_payload(user)


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _public_user_payload(user, "OK")


@router.get("/users/{user_id}/profile")
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _profile_payload(user)


@router.put("/users/{user_id}/profile")
def update_user_profile(user_id: int, profile: UserProfileUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    cols = _user_columns()

    if profile.name is not None:
        cleaned = profile.name.strip()
        if not cleaned:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name cannot be empty")
        if "name" in cols:
            user.name = cleaned
        if "username" in cols:
            user.username = cleaned
    if profile.full_name is not None and "full_name" in cols:
        user.full_name = profile.full_name.strip()
    if profile.phone is not None and "phone" in cols:
        user.phone = profile.phone.strip()
    if profile.birth_date is not None and "birth_date" in cols:
        user.birth_date = profile.birth_date.strip()

    db.add(user)
    db.commit()
    db.refresh(user)
    return _profile_payload(user)


@router.post("/users/{user_id}/pro")
def update_pro_status(user_id: int, payload: ProStatusUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    cols = _user_columns()
    if "is_pro" in cols:
        user.is_pro = bool(payload.enabled)
    db.add(user)
    db.commit()
    db.refresh(user)
    return _profile_payload(user)


@router.get("/users", response_model=list[UserResponse])
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [_public_user_payload(u, "OK") for u in users]


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    db.delete(user)
    db.commit()
    return None
