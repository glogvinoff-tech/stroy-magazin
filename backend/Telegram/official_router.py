import os
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

router = APIRouter(prefix="/api/auth/telegram/official", tags=["telegram-official"])


def _frontend_public_url() -> str:
    explicit = (os.getenv("FRONTEND_PUBLIC_URL") or "").strip().rstrip("/")
    if explicit:
        return explicit
    return "http://localhost:3000"


@router.get("/widget-config")
def telegram_widget_config():
    bot_username = (os.getenv("TELEGRAM_BOT_USERNAME") or "").strip().lstrip("@")
    if not bot_username:
        raise HTTPException(status_code=500, detail="TELEGRAM_BOT_USERNAME is not configured")
    callback_url = f"{_frontend_public_url()}/auth/telegram/callback"
    auth_url = f"{_frontend_public_url()}/api/auth/telegram/official/callback"
    return {
        "bot_username": bot_username,
        "auth_url": auth_url,
        "callback_url": callback_url,
    }


@router.get("/callback")
async def telegram_official_callback(request: Request):
    params = dict(request.query_params)
    required = ["id", "auth_date", "hash"]
    if not all(params.get(k) for k in required):
        raise HTTPException(status_code=400, detail="Telegram callback payload is invalid")

    query = request.url.query
    redirect_to = f"{_frontend_public_url()}/auth/telegram/callback?{query}"
    return RedirectResponse(url=redirect_to, status_code=302)

