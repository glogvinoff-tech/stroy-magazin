from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import SupportThread, SupportMessage, User
from datetime import datetime

router = APIRouter(prefix="/api/support", tags=["support"])


class SupportMessageCreate(BaseModel):
    text: str


def _get_user(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _is_admin(user: User) -> bool:
    try:
        if getattr(user, "role", None) and getattr(user.role, "name", None) == "admin":
            return True
    except Exception:
        pass
    return int(getattr(user, "role_id", 0) or 0) == 2


def _thread_payload(thread: SupportThread) -> dict:
    return {
        "id": thread.id,
        "user_id": thread.user_id,
        "status": thread.status,
        "last_message_at": thread.last_message_at,
        "created_at": thread.created_at,
    }


def _message_payload(msg: SupportMessage) -> dict:
    return {
        "id": msg.id,
        "thread_id": msg.thread_id,
        "sender_role": msg.sender_role,
        "sender_user_id": msg.sender_user_id,
        "text": msg.text,
        "created_at": msg.created_at,
    }


@router.get("/thread")
def get_or_create_thread(user_id: int, db: Session = Depends(get_db)):
    _get_user(db, user_id)
    th = db.query(SupportThread).filter(SupportThread.user_id == user_id).first()
    if not th:
        th = SupportThread(user_id=user_id, status="open")
        db.add(th)
        db.commit()
        db.refresh(th)
    return _thread_payload(th)


@router.get("/thread/{thread_id}/messages")
def list_thread_messages(thread_id: int, user_id: int, db: Session = Depends(get_db)):
    th = db.query(SupportThread).filter(SupportThread.id == thread_id).first()
    if not th:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    if th.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    msgs = db.query(SupportMessage).filter(SupportMessage.thread_id == thread_id).order_by(SupportMessage.created_at.asc()).all()
    return [_message_payload(m) for m in msgs]


@router.post("/thread/{thread_id}/messages")
def post_user_message(thread_id: int, user_id: int, payload: SupportMessageCreate, db: Session = Depends(get_db)):
    user = _get_user(db, user_id)
    th = db.query(SupportThread).filter(SupportThread.id == thread_id).first()
    if not th:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    if th.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message is empty")

    msg = SupportMessage(thread_id=thread_id, sender_role="user", sender_user_id=user.id, text=text)
    th.last_message_at = datetime.utcnow()
    db.add(msg)
    db.add(th)
    db.commit()
    db.refresh(msg)
    return _message_payload(msg)


@router.get("/admin/threads")
def admin_list_threads(admin_id: int, db: Session = Depends(get_db)):
    admin = _get_user(db, admin_id)
    if not _is_admin(admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    threads = db.query(SupportThread).order_by(desc(SupportThread.last_message_at), desc(SupportThread.created_at)).all()
    user_ids = {t.user_id for t in threads}
    users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
    user_map = {u.id: u for u in users}
    return [
        {
            **_thread_payload(t),
            "user": {
                "id": user_map.get(t.user_id).id if user_map.get(t.user_id) else t.user_id,
                "name": (getattr(user_map.get(t.user_id), "name", None) or getattr(user_map.get(t.user_id), "username", None) or "user") if user_map.get(t.user_id) else "user",
                "is_pro": bool(getattr(user_map.get(t.user_id), "is_pro", False)) if user_map.get(t.user_id) else False,
            },
        }
        for t in threads
    ]


@router.get("/admin/threads/{thread_id}/messages")
def admin_list_messages(thread_id: int, admin_id: int, db: Session = Depends(get_db)):
    admin = _get_user(db, admin_id)
    if not _is_admin(admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    th = db.query(SupportThread).filter(SupportThread.id == thread_id).first()
    if not th:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    msgs = db.query(SupportMessage).filter(SupportMessage.thread_id == thread_id).order_by(SupportMessage.created_at.asc()).all()
    return [_message_payload(m) for m in msgs]


@router.post("/admin/threads/{thread_id}/messages")
def admin_post_message(thread_id: int, admin_id: int, payload: SupportMessageCreate, db: Session = Depends(get_db)):
    admin = _get_user(db, admin_id)
    if not _is_admin(admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    th = db.query(SupportThread).filter(SupportThread.id == thread_id).first()
    if not th:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message is empty")

    msg = SupportMessage(thread_id=thread_id, sender_role="admin", sender_user_id=admin.id, text=text)
    th.last_message_at = datetime.utcnow()
    db.add(msg)
    db.add(th)
    db.commit()
    db.refresh(msg)
    return _message_payload(msg)
