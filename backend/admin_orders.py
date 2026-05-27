from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import Order, User, Role, WarehouseMovement, WarehouseStock
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
        "stock_reserved": bool(getattr(o, "stock_reserved", False)),
        "stock_committed": bool(getattr(o, "stock_committed", False)),
        "created_at": o.created_at,
    }


def _order_items(o: Order) -> list[dict]:
    try:
        items = json.loads(o.items_json or "[]")
        return items if isinstance(items, list) else []
    except Exception:
        return []


def _release_reserve(db: Session, o: Order, reason: str) -> None:
    restaurant_id = getattr(o, "restaurant_id", None)
    if not restaurant_id or not bool(getattr(o, "stock_reserved", False)):
        return
    for it in _order_items(o):
        item_id = int(it.get("id") or 0)
        qty = max(1, int(it.get("qty") or it.get("quantity") or 1))
        row = db.query(WarehouseStock).filter(WarehouseStock.menu_item_id == item_id, WarehouseStock.restaurant_id == restaurant_id).first()
        if not row:
            continue
        row.reserved = max(0, int(row.reserved or 0) - qty)
        db.add(row)
        db.add(WarehouseMovement(
            stock_id=row.id,
            menu_item_id=row.menu_item_id,
            restaurant_id=row.restaurant_id,
            user_id=o.user_id,
            delta=0,
            quantity_after=int(row.quantity or 0),
            reason=reason,
            document_no=f"ORDER-{o.id}",
        ))
    o.stock_reserved = False


def _commit_stock(db: Session, o: Order) -> None:
    restaurant_id = getattr(o, "restaurant_id", None)
    if not restaurant_id or bool(getattr(o, "stock_committed", False)):
        return
    for it in _order_items(o):
        item_id = int(it.get("id") or 0)
        qty = max(1, int(it.get("qty") or it.get("quantity") or 1))
        row = db.query(WarehouseStock).filter(WarehouseStock.menu_item_id == item_id, WarehouseStock.restaurant_id == restaurant_id).first()
        if not row:
            continue
        if bool(getattr(o, "stock_reserved", False)):
            row.reserved = max(0, int(row.reserved or 0) - qty)
        row.quantity = max(0, int(row.quantity or 0) - qty)
        db.add(row)
        db.add(WarehouseMovement(
            stock_id=row.id,
            menu_item_id=row.menu_item_id,
            restaurant_id=row.restaurant_id,
            user_id=o.user_id,
            delta=-qty,
            quantity_after=int(row.quantity or 0),
            reason=f"Списание по заказу #{o.id}",
            document_no=f"ORDER-{o.id}",
        ))
    o.stock_reserved = False
    o.stock_committed = True


def _return_committed_stock(db: Session, o: Order) -> None:
    restaurant_id = getattr(o, "restaurant_id", None)
    if not restaurant_id or not bool(getattr(o, "stock_committed", False)):
        return
    for it in _order_items(o):
        item_id = int(it.get("id") or 0)
        qty = max(1, int(it.get("qty") or it.get("quantity") or 1))
        row = db.query(WarehouseStock).filter(WarehouseStock.menu_item_id == item_id, WarehouseStock.restaurant_id == restaurant_id).first()
        if not row:
            continue
        row.quantity = max(0, int(row.quantity or 0) + qty)
        db.add(row)
        db.add(WarehouseMovement(
            stock_id=row.id,
            menu_item_id=row.menu_item_id,
            restaurant_id=row.restaurant_id,
            user_id=o.user_id,
            delta=qty,
            quantity_after=int(row.quantity or 0),
            reason=f"Возврат отменённого заказа #{o.id}",
            document_no=f"ORDER-{o.id}",
        ))
    o.stock_committed = False


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
    prev_status = (getattr(row, "status", None) or "pending").lower()
    if next_status == "cancelled":
        _release_reserve(db, row, f"Снятие резерва заказа #{row.id}")
        _return_committed_stock(db, row)
    elif next_status in {"confirmed", "cooking", "ready", "delivered"} and prev_status == "pending":
        _commit_stock(db, row)
    row.status = next_status
    db.add(row)
    db.commit()
    db.refresh(row)
    return _payload(row)
