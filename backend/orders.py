from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
import json

from database import get_db
from models import Order, User


router = APIRouter(prefix="/api/orders", tags=["orders"])


class OrderItem(BaseModel):
    id: int
    qty: int
    price: int | None = None
    name: str | None = None


class OrderCreate(BaseModel):
    items: list[OrderItem]
    total: int
    fulfillment: str | None = None
    fulfillment_time: str | None = None
    payment: str | None = None
    restaurant_id: int | None = None
    address: str | None = None
    comment: str | None = None


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


@router.post("")
@router.post("/")
def create_order(payload: OrderCreate, user_id: int | None = Query(None), db: Session = Depends(get_db)):
    items = payload.items or []
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="items is required")

    fulfillment = (payload.fulfillment or "").strip().lower()
    if fulfillment and fulfillment not in {"delivery", "pickup"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid fulfillment")

    ft = (payload.fulfillment_time or "").strip()
    
    if fulfillment == "delivery":
        addr = (payload.address or "").strip()
        if not addr:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="address is required")

    total = int(payload.total or 0)
    if total < 0:
        total = 0

    if user_id is not None:
        u = db.query(User).filter(User.id == user_id).first()
        if not u:
            user_id = None

    items_json = json.dumps([it.model_dump() for it in items], ensure_ascii=False)
    o = Order(
        user_id=user_id,
        items_json=items_json,
        total=total,
        fulfillment=fulfillment or None,
        fulfillment_time=ft or None,
        restaurant_id=payload.restaurant_id,
        address=(payload.address or "").strip() or None,
        payment=(payload.payment or "").strip() or None,
        comment=(payload.comment or "").strip() or None,
        status="pending",
    )
    db.add(o)
    db.commit()
    db.refresh(o)
    return _payload(o)


@router.get("")
@router.get("/")
def list_user_orders(user_id: int | None = Query(None), db: Session = Depends(get_db)):
    if user_id is None:
        return []
    rows = db.query(Order).filter(Order.user_id == user_id).order_by(Order.created_at.desc()).all()
    return [_payload(o) for o in rows]
