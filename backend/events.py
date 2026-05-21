from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import Event, User
from datetime import datetime

router = APIRouter(prefix="/api/events", tags=["events"])


class EventCreate(BaseModel):
    title: str
    description: str | None = None
    starts_at: str | None = None  # ISO
    ends_at: str | None = None  # ISO
    image_url: str | None = None
    is_private: bool = False


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    starts_at: str | None = None
    ends_at: str | None = None
    image_url: str | None = None
    is_private: bool | None = None


def _get_user(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _is_admin(user: User) -> bool:
    try:
        return bool(getattr(user.role, "name", None) == "admin")
    except Exception:
        return False


def _require_admin(db: Session, admin_id: int) -> User:
    admin = _get_user(db, admin_id)
    if not _is_admin(admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return admin


def _parse_dt(value: str | None) -> datetime | None:
    raw = (value or "").strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        return None


def _payload(ev: Event, locked: bool = False) -> dict:
    return {
        "id": ev.id,
        "title": ev.title if not locked else (ev.title or "Закрытое событие"),
        "description": (ev.description or "") if not locked else "",
        "starts_at": ev.starts_at,
        "ends_at": ev.ends_at,
        "image_url": ev.image_url or "",
        "is_private": bool(ev.is_private),
        "locked": bool(locked),
        "created_at": ev.created_at,
    }


@router.get("/")
def list_events(user_id: int | None = None, past: bool = False, db: Session = Depends(get_db)):
    is_pro = False
    if user_id:
        try:
            u = db.query(User).filter(User.id == user_id).first()
            is_pro = bool(getattr(u, "is_pro", False)) if u else False
        except Exception:
            is_pro = False

    now = datetime.utcnow()
    events_q = db.query(Event).order_by(desc(Event.starts_at), desc(Event.created_at)).all()
    out = []
    for ev in events_q:
        # Determine if event is past: starts_at is set and in the past (or ends_at in the past)
        is_past = False
        if ev.ends_at:
            try:
                ends = ev.ends_at.replace(tzinfo=None) if ev.ends_at.tzinfo else ev.ends_at
                is_past = ends < now
            except Exception:
                pass
        elif ev.starts_at:
            try:
                starts = ev.starts_at.replace(tzinfo=None) if ev.starts_at.tzinfo else ev.starts_at
                is_past = starts < now
            except Exception:
                pass

        # Filter: past=True shows only past events, past=False (default) shows only upcoming/current
        if past and not is_past:
            continue
        if not past and is_past:
            continue

        if ev.is_private and not is_pro:
            out.append(_payload(ev, locked=True))
        else:
            out.append(_payload(ev, locked=False))
    return out


@router.post("/")
def create_event(payload: EventCreate, admin_id: int, db: Session = Depends(get_db)):
    _require_admin(db, admin_id)
    title = (payload.title or "").strip()
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="title is required")
    ev = Event(
        title=title,
        description=(payload.description or "").strip() or None,
        starts_at=_parse_dt(payload.starts_at),
        ends_at=_parse_dt(payload.ends_at),
        image_url=(payload.image_url or "").strip() or None,
        is_private=bool(payload.is_private),
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return _payload(ev, locked=False)


@router.put("/{event_id}")
def update_event(event_id: int, payload: EventUpdate, admin_id: int, db: Session = Depends(get_db)):
    _require_admin(db, admin_id)
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    data = payload.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        ev.title = (data["title"] or "").strip()
    if "description" in data:
        ev.description = (data["description"] or "").strip() or None
    if "starts_at" in data:
        ev.starts_at = _parse_dt(data["starts_at"])
    if "ends_at" in data:
        ev.ends_at = _parse_dt(data["ends_at"])
    if "image_url" in data:
        ev.image_url = (data["image_url"] or "").strip() or None
    if "is_private" in data and data["is_private"] is not None:
        ev.is_private = bool(data["is_private"])
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return _payload(ev, locked=False)


@router.delete("/{event_id}")
def delete_event(event_id: int, admin_id: int, db: Session = Depends(get_db)):
    _require_admin(db, admin_id)
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    db.delete(ev)
    db.commit()
    return {"ok": True}

