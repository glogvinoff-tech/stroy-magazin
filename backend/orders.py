from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
import json

from database import get_db
from models import MenuItem, Order, User, WarehouseMovement, WarehouseStock


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

    stock_rows = {}
    if payload.restaurant_id:
        for it in items:
            row = (
                db.query(WarehouseStock)
                .filter(WarehouseStock.menu_item_id == it.id, WarehouseStock.restaurant_id == payload.restaurant_id)
                .first()
            )
            available = max(0, int(getattr(row, "quantity", 0) or 0) - int(getattr(row, "reserved", 0) or 0)) if row else 0
            requested = max(1, int(it.qty or 1))
            if available < requested:
                item = db.query(MenuItem).filter(MenuItem.id == it.id).first()
                name = getattr(item, "name", None) or it.name or f"#{it.id}"
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Недостаточно товара на складе: {name}. Доступно: {available}",
                )
            stock_rows[it.id] = row

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
        stock_reserved=bool(stock_rows),
        stock_committed=False,
    )
    db.add(o)
    for it in items:
        row = stock_rows.get(it.id)
        if row:
            qty = max(1, int(it.qty or 1))
            row.reserved = max(0, int(row.reserved or 0) + qty)
            db.add(row)
            db.add(WarehouseMovement(
                stock_id=row.id,
                menu_item_id=row.menu_item_id,
                restaurant_id=row.restaurant_id,
                user_id=user_id,
                delta=0,
                quantity_after=int(row.quantity or 0),
                reason=f"Резерв заказа",
                document_no=None,
            ))
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
