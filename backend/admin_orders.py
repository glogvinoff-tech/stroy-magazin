from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import Order, User, Role
import json


router = APIRouter(prefix="/api/admin/orders", tags=["admin"])


class OrderStatusUpdate(BaseModel):
    status: str


def _is_admin(db: Session, user_id: int) -> bool:
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        return False
    role_name = None
    try:
        role_name = getattr(u.role, "name", None)
    except Exception:
        role_name = None
    if not role_name and getattr(u, "role_id", None):
        role = db.query(Role).filter(Role.id == u.role_id).first()
        role_name = getattr(role, "name", None) if role else None
    return role_name == "admin"


def _payload(o: Order) -> dict:
    items = []
    try:
        items = json.loads(o.items_json or "[]")
        if not isinstance(items, list):
            items = []
    except Exception:
        items = []
    return {
        "id": o.id,
        "user_id": o.user_id,
        "items": items,
        "total": o.total,
        "fulfillment": o.fulfillment,
        "fulfillment_time": o.fulfillment_time,
        "restaurant_id": getattr(o, "restaurant_id", None),
        "address": o.address,
        "payment": o.payment,
        "comment": o.comment,
        "status": getattr(o, "status", None) or "pending",
        "created_at": o.created_at,
    }


@router.get("/")
def list_orders(admin_id: int = Query(...), db: Session = Depends(get_db)):
    if not _is_admin(db, admin_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    rows = db.query(Order).order_by(Order.created_at.desc()).all()
    return [_payload(o) for o in rows]


@router.put("/{order_id}/status")
def update_order_status(order_id: int, payload: OrderStatusUpdate, admin_id: int = Query(...), db: Session = Depends(get_db)):
    if not _is_admin(db, admin_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    next_status = (payload.status or "").strip().lower()
    if next_status not in {"pending", "confirmed", "cooking", "ready", "delivered", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid order status")
    row = db.query(Order).filter(Order.id == order_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    row.status = next_status
    db.add(row)
    db.commit()
    db.refresh(row)
    return _payload(row)
