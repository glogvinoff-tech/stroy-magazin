from datetime import datetime
import csv
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import MenuItem, Restaurant, Role, User, WarehouseDocument, WarehouseMovement, WarehouseStock


router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])


class StockUpdate(BaseModel):
    quantity: int | None = None
    min_quantity: int | None = None
    sku: str | None = None
    barcode: str | None = None
    data_matrix: str | None = None
    batch: str | None = None
    location: str | None = None
    storage_condition: str | None = None
    supplier: str | None = None
    expires_at: str | None = None
    document_no: str | None = None


class StockAdjust(BaseModel):
    delta: int
    reason: str | None = None
    document_no: str | None = None


class DocumentCreate(BaseModel):
    kind: str
    menu_item_id: int
    restaurant_id: int
    quantity: int
    document_no: str | None = None
    comment: str | None = None


def _require_admin(db: Session, admin_id: int) -> User:
    user = db.query(User).filter(User.id == admin_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    role_name = None
    try:
        role_name = getattr(user.role, "name", None)
    except Exception:
        role_name = None
    if not role_name and getattr(user, "role_id", None):
        role = db.query(Role).filter(Role.id == user.role_id).first()
        role_name = getattr(role, "name", None) if role else None
    if role_name != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


def _stock_row(db: Session, item_id: int, restaurant_id: int, create: bool = False) -> WarehouseStock | None:
    row = (
        db.query(WarehouseStock)
        .filter(WarehouseStock.menu_item_id == item_id, WarehouseStock.restaurant_id == restaurant_id)
        .first()
    )
    if row or not create:
        return row
    row = WarehouseStock(menu_item_id=item_id, restaurant_id=restaurant_id, quantity=0, reserved=0, min_quantity=5)
    db.add(row)
    db.flush()
    return row


def _payload(row: WarehouseStock | None, item: MenuItem, restaurant: Restaurant) -> dict:
    quantity = int(getattr(row, "quantity", 0) or 0)
    reserved = int(getattr(row, "reserved", 0) or 0)
    min_quantity = int(getattr(row, "min_quantity", 5) or 0)
    available = max(0, quantity - reserved)
    if available <= 0:
        status_label = "Нет в наличии"
        status = "out"
    elif available <= min_quantity:
        status_label = "Заканчивается"
        status = "low"
    else:
        status_label = "В наличии"
        status = "ok"
    return {
        "id": getattr(row, "id", None),
        "menu_item_id": item.id,
        "restaurant_id": restaurant.id,
        "quantity": quantity,
        "reserved": reserved,
        "available": available,
        "min_quantity": min_quantity,
        "sku": getattr(row, "sku", None) or "",
        "barcode": getattr(row, "barcode", None) or "",
        "data_matrix": getattr(row, "data_matrix", None) or "",
        "batch": getattr(row, "batch", None) or "",
        "location": getattr(row, "location", None) or "",
        "storage_condition": getattr(row, "storage_condition", None) or "",
        "supplier": getattr(row, "supplier", None) or "",
        "expires_at": getattr(row, "expires_at", None) or "",
        "status": status,
        "status_label": status_label,
        "updated_at": getattr(row, "updated_at", None),
        "item": {
            "id": item.id,
            "name": item.name,
            "cat": item.cat,
            "price": item.price,
            "is_active": bool(item.is_active),
        },
        "restaurant": {
            "id": restaurant.id,
            "name": restaurant.name,
            "address": restaurant.address,
        },
    }


def _record_movement(
    db: Session,
    row: WarehouseStock,
    user_id: int | None,
    delta: int,
    reason: str | None = None,
    document_no: str | None = None,
) -> None:
    if not delta:
        return
    db.add(WarehouseMovement(
        stock_id=row.id,
        menu_item_id=row.menu_item_id,
        restaurant_id=row.restaurant_id,
        user_id=user_id,
        delta=int(delta),
        quantity_after=int(row.quantity or 0),
        reason=(str(reason or "").strip() or None),
        document_no=(str(document_no or "").strip() or None),
    ))


def _document_payload(doc: WarehouseDocument) -> dict:
    return {
        "id": doc.id,
        "kind": doc.kind,
        "document_no": doc.document_no or "",
        "menu_item_id": doc.menu_item_id,
        "restaurant_id": doc.restaurant_id,
        "quantity": doc.quantity,
        "quantity_before": doc.quantity_before,
        "quantity_after": doc.quantity_after,
        "comment": doc.comment or "",
        "created_at": doc.created_at,
        "item_name": getattr(doc.item, "name", "") if doc.item else "",
        "restaurant_address": getattr(doc.restaurant, "address", "") if doc.restaurant else "",
    }


@router.get("")
@router.get("/")
def list_stock(admin_id: int, restaurant_id: int | None = None, db: Session = Depends(get_db)):
    _require_admin(db, admin_id)
    items = db.query(MenuItem).order_by(MenuItem.cat.asc(), MenuItem.name.asc()).all()
    restaurants_q = db.query(Restaurant).order_by(Restaurant.id.asc())
    if restaurant_id:
        restaurants_q = restaurants_q.filter(Restaurant.id == restaurant_id)
    restaurants = restaurants_q.all()
    stocks = {
        (s.menu_item_id, s.restaurant_id): s
        for s in db.query(WarehouseStock).all()
    }
    rows = []
    for item in items:
        for restaurant in restaurants:
            rows.append(_payload(stocks.get((item.id, restaurant.id)), item, restaurant))
    return rows


@router.get("/export.csv")
def export_stock_csv(admin_id: int, restaurant_id: int | None = None, db: Session = Depends(get_db)):
    _require_admin(db, admin_id)
    rows = list_stock(admin_id=admin_id, restaurant_id=restaurant_id, db=db)
    buf = StringIO()
    writer = csv.writer(buf, delimiter=";")
    writer.writerow(["Товар", "Категория", "Магазин", "Адрес", "Остаток", "Резерв", "Доступно", "Мин.", "Докупить", "Артикул", "Штрихкод", "Data Matrix", "Партия", "Место", "Поставщик", "Срок"])
    for row in rows:
        available = int(row.get("available") or 0)
        min_qty = int(row.get("min_quantity") or 0)
        writer.writerow([
            row["item"]["name"],
            row["item"]["cat"],
            row["restaurant"]["name"],
            row["restaurant"]["address"],
            row["quantity"],
            row["reserved"],
            available,
            min_qty,
            max(0, min_qty - available),
            row["sku"],
            row["barcode"],
            row["data_matrix"],
            row["batch"],
            row["location"],
            row["supplier"],
            row["expires_at"],
        ])
    return Response(
        content="\ufeff" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=warehouse-stock.csv"},
    )


@router.put("/{item_id}/{restaurant_id}")
def update_stock(item_id: int, restaurant_id: int, payload: StockUpdate, admin_id: int, db: Session = Depends(get_db)):
    _require_admin(db, admin_id)
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not item or not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item or store not found")

    row = _stock_row(db, item_id, restaurant_id, create=True)
    old_quantity = int(row.quantity or 0)
    if payload.quantity is not None:
        row.quantity = max(0, int(payload.quantity or 0))
    if payload.min_quantity is not None:
        row.min_quantity = max(0, int(payload.min_quantity or 0))
    if payload.sku is not None:
        row.sku = str(payload.sku or "").strip() or None
    if payload.barcode is not None:
        row.barcode = str(payload.barcode or "").strip() or None
    if payload.data_matrix is not None:
        row.data_matrix = str(payload.data_matrix or "").strip() or None
    if payload.batch is not None:
        row.batch = str(payload.batch or "").strip() or None
    if payload.location is not None:
        row.location = str(payload.location or "").strip() or None
    if payload.storage_condition is not None:
        row.storage_condition = str(payload.storage_condition or "").strip() or None
    if payload.supplier is not None:
        row.supplier = str(payload.supplier or "").strip() or None
    if payload.expires_at is not None:
        row.expires_at = str(payload.expires_at or "").strip() or None
    row.updated_at = datetime.utcnow()
    db.add(row)
    _record_movement(db, row, admin_id, int(row.quantity or 0) - old_quantity, "Корректировка", payload.document_no)
    db.commit()
    db.refresh(row)
    return _payload(row, item, restaurant)


@router.post("/{item_id}/{restaurant_id}/adjust")
def adjust_stock(item_id: int, restaurant_id: int, payload: StockAdjust, admin_id: int, db: Session = Depends(get_db)):
    _require_admin(db, admin_id)
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not item or not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item or store not found")

    row = _stock_row(db, item_id, restaurant_id, create=True)
    row.quantity = max(0, int(row.quantity or 0) + int(payload.delta or 0))
    row.updated_at = datetime.utcnow()
    db.add(row)
    _record_movement(db, row, admin_id, int(payload.delta or 0), payload.reason, payload.document_no)
    db.commit()
    db.refresh(row)
    return _payload(row, item, restaurant)


@router.post("/documents")
def create_document(payload: DocumentCreate, admin_id: int, db: Session = Depends(get_db)):
    _require_admin(db, admin_id)
    kind = (payload.kind or "").strip().lower()
    if kind not in {"receipt", "writeoff", "inventory"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid document kind")
    item = db.query(MenuItem).filter(MenuItem.id == payload.menu_item_id).first()
    restaurant = db.query(Restaurant).filter(Restaurant.id == payload.restaurant_id).first()
    if not item or not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item or store not found")

    row = _stock_row(db, payload.menu_item_id, payload.restaurant_id, create=True)
    before = int(row.quantity or 0)
    qty = max(0, int(payload.quantity or 0))
    if kind == "receipt":
        delta = qty
        row.quantity = before + qty
        reason = "Приходная накладная"
    elif kind == "writeoff":
        delta = -min(before, qty)
        row.quantity = max(0, before - qty)
        reason = "Списание"
    else:
        row.quantity = qty
        delta = qty - before
        reason = "Инвентаризация"

    row.updated_at = datetime.utcnow()
    db.add(row)
    doc = WarehouseDocument(
        kind=kind,
        document_no=(payload.document_no or "").strip() or None,
        menu_item_id=item.id,
        restaurant_id=restaurant.id,
        quantity=qty,
        quantity_before=before,
        quantity_after=int(row.quantity or 0),
        user_id=admin_id,
        comment=(payload.comment or "").strip() or None,
    )
    db.add(doc)
    _record_movement(db, row, admin_id, delta, reason, payload.document_no)
    db.commit()
    db.refresh(doc)
    return _document_payload(doc)


@router.get("/documents")
def list_documents(admin_id: int, limit: int = 80, db: Session = Depends(get_db)):
    _require_admin(db, admin_id)
    rows = db.query(WarehouseDocument).order_by(WarehouseDocument.created_at.desc(), WarehouseDocument.id.desc()).limit(max(1, min(200, int(limit or 80)))).all()
    return [_document_payload(d) for d in rows]


@router.get("/movements")
def list_movements(admin_id: int, restaurant_id: int | None = None, item_id: int | None = None, limit: int = 80, db: Session = Depends(get_db)):
    _require_admin(db, admin_id)
    q = db.query(WarehouseMovement).order_by(WarehouseMovement.created_at.desc(), WarehouseMovement.id.desc())
    if restaurant_id:
        q = q.filter(WarehouseMovement.restaurant_id == restaurant_id)
    if item_id:
        q = q.filter(WarehouseMovement.menu_item_id == item_id)
    rows = q.limit(max(1, min(200, int(limit or 80)))).all()
    return [
        {
            "id": m.id,
            "menu_item_id": m.menu_item_id,
            "restaurant_id": m.restaurant_id,
            "delta": m.delta,
            "quantity_after": m.quantity_after,
            "reason": m.reason or "",
            "document_no": m.document_no or "",
            "created_at": m.created_at,
            "item_name": getattr(m.item, "name", "") if m.item else "",
            "restaurant_address": getattr(m.restaurant, "address", "") if m.restaurant else "",
        }
        for m in rows
    ]


@router.delete("/{item_id}/{restaurant_id}")
def clear_stock(item_id: int, restaurant_id: int, admin_id: int, db: Session = Depends(get_db)):
    _require_admin(db, admin_id)
    row = _stock_row(db, item_id, restaurant_id, create=False)
    if row:
        db.delete(row)
        db.commit()
    return {"ok": True, "menu_item_id": item_id, "restaurant_id": restaurant_id}
