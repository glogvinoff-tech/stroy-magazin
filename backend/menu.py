from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import MenuItem, User, WarehouseStock
from datetime import datetime
import json

router = APIRouter(prefix="/api/menu", tags=["menu"])


class MenuItemCreate(BaseModel):
    cat: str
    name: str
    price: int = 0
    discount_percent: int = 0
    weight: str | None = None
    badge: str | None = None
    tags: list[str] = []
    img: str | None = None
    gallery: list[str] = []
    desc: str | None = None
    ingr: str | None = None
    is_active: bool = True


class MenuItemUpdate(BaseModel):
    cat: str | None = None
    name: str | None = None
    price: int | None = None
    discount_percent: int | None = None
    weight: str | None = None
    badge: str | None = None
    tags: list[str] | None = None
    img: str | None = None
    gallery: list[str] | None = None
    desc: str | None = None
    ingr: str | None = None
    is_active: bool | None = None


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


def _norm_tags(tags: list[str]) -> list[str]:
    cleaned = []
    for t in tags or []:
        v = str(t or "").strip()
        if v and v not in cleaned:
            cleaned.append(v)
    return cleaned


def _tags_to_json(tags: list[str]) -> str:
    return json.dumps(_norm_tags(tags), ensure_ascii=False)


def _tags_from_json(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return _norm_tags([str(x) for x in parsed])
    except Exception:
        return []
    return []


def _gallery_to_json(items: list[str]) -> str:
    cleaned = []
    for item in items or []:
        url = str(item or "").strip()
        if url and url not in cleaned:
            cleaned.append(url)
    return json.dumps(cleaned, ensure_ascii=False)


def _gallery_from_json(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            result = []
            for item in parsed:
                url = str(item or "").strip()
                if url and url not in result:
                    result.append(url)
            return result
    except Exception:
        return []
    return []


def _stock_summary(item_id: int, stock_map: dict[int, list[WarehouseStock]] | None = None) -> tuple[int, dict[str, int]]:
    rows = (stock_map or {}).get(item_id, [])
    by_restaurant: dict[str, int] = {}
    total = 0
    for row in rows:
        available = max(0, int(getattr(row, "quantity", 0) or 0) - int(getattr(row, "reserved", 0) or 0))
        by_restaurant[str(row.restaurant_id)] = available
        total += available
    return total, by_restaurant


def _payload(item: MenuItem, stock_map: dict[int, list[WarehouseStock]] | None = None) -> dict:
    stock_total, stock_by_restaurant = _stock_summary(item.id, stock_map)
    return {
        "id": item.id,
        "cat": item.cat,
        "name": item.name,
        "price": item.price,
        "discount_percent": int(getattr(item, "discount_percent", 0) or 0),
        "weight": item.weight or "",
        "badge": item.badge or "",
        "tags": _tags_from_json(item.tags_json),
        "img": item.img or "",
        "gallery": _gallery_from_json(getattr(item, "gallery_json", None)),
        "desc": item.desc or "",
        "ingr": item.ingr or "",
        "is_active": bool(item.is_active),
        "stock_total": stock_total,
        "stock_by_restaurant": stock_by_restaurant,
        "stock_status": "out" if stock_total <= 0 else "low" if stock_total <= 5 else "ok",
        "updated_at": item.updated_at,
    }


def _load_stock_map(db: Session) -> dict[int, list[WarehouseStock]]:
    rows = db.query(WarehouseStock).all()
    out: dict[int, list[WarehouseStock]] = {}
    for row in rows:
        out.setdefault(row.menu_item_id, []).append(row)
    return out


@router.get("/items")
def list_items(include_inactive: bool = False, admin_id: int | None = None, db: Session = Depends(get_db)):
    if include_inactive:
        if not admin_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="admin_id is required")
        _require_admin(db, admin_id)
        items = db.query(MenuItem).order_by(desc(MenuItem.updated_at), desc(MenuItem.id)).all()
        stock_map = _load_stock_map(db)
        return [_payload(i, stock_map) for i in items]

    items = db.query(MenuItem).filter(MenuItem.is_active == True).order_by(MenuItem.cat.asc(), MenuItem.id.asc()).all()  # noqa: E712
    stock_map = _load_stock_map(db)
    return [_payload(i, stock_map) for i in items]


@router.get("/cats")
def list_categories(db: Session = Depends(get_db)):
    rows = db.query(MenuItem.cat).filter(MenuItem.is_active == True).distinct().all()  # noqa: E712
    cats = sorted({r[0] for r in rows if r and r[0]})
    return cats


@router.post("/items")
def create_item(payload: MenuItemCreate, admin_id: int, db: Session = Depends(get_db)):
    _require_admin(db, admin_id)
    cat = (payload.cat or "").strip()
    name = (payload.name or "").strip()
    if not cat or not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="cat and name are required")

    discount_percent = int(payload.discount_percent or 0)
    if discount_percent < 0 or discount_percent > 90:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="discount_percent must be 0..90")
    item = MenuItem(
        cat=cat,
        name=name,
        price=int(payload.price or 0),
        discount_percent=discount_percent,
        weight=(payload.weight or "").strip() or None,
        badge=(payload.badge or "").strip() or None,
        tags_json=_tags_to_json(payload.tags or []),
        img=(payload.img or "").strip() or None,
        gallery_json=_gallery_to_json(payload.gallery or []),
        desc=(payload.desc or "").strip() or None,
        ingr=(payload.ingr or "").strip() or None,
        is_active=bool(payload.is_active),
        updated_at=datetime.utcnow(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _payload(item, _load_stock_map(db))


@router.put("/items/{item_id}")
def update_item(item_id: int, payload: MenuItemUpdate, admin_id: int, db: Session = Depends(get_db)):
    _require_admin(db, admin_id)
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    data = payload.model_dump(exclude_unset=True)
    if "cat" in data:
        item.cat = (data["cat"] or "").strip()
    if "name" in data:
        item.name = (data["name"] or "").strip()
    if "price" in data and data["price"] is not None:
        item.price = int(data["price"])
    if "discount_percent" in data and data["discount_percent"] is not None:
        discount_percent = int(data["discount_percent"])
        if discount_percent < 0 or discount_percent > 90:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="discount_percent must be 0..90")
        item.discount_percent = discount_percent
    if "weight" in data:
        item.weight = (data["weight"] or "").strip() or None
    if "badge" in data:
        item.badge = (data["badge"] or "").strip() or None
    if "tags" in data:
        item.tags_json = _tags_to_json(data["tags"] or [])
    if "img" in data:
        item.img = (data["img"] or "").strip() or None
    if "gallery" in data:
        item.gallery_json = _gallery_to_json(data["gallery"] or [])
    if "desc" in data:
        item.desc = (data["desc"] or "").strip() or None
    if "ingr" in data:
        item.ingr = (data["ingr"] or "").strip() or None
    if "is_active" in data and data["is_active"] is not None:
        item.is_active = bool(data["is_active"])

    item.updated_at = datetime.utcnow()
    db.add(item)
    db.commit()
    db.refresh(item)
    return _payload(item, _load_stock_map(db))


@router.delete("/items/{item_id}")
def delete_item(item_id: int, admin_id: int, db: Session = Depends(get_db)):
    _require_admin(db, admin_id)
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}
