from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import Restaurant, Table, User, Role
from typing import List

router = APIRouter(prefix="/api/restaurants", tags=["restaurants"])


class RestaurantCreate(BaseModel):
    name: str
    address: str
    phone: str | None = None


class RestaurantUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None


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


def _payload(r: Restaurant) -> dict:
    return {"id": r.id, "name": r.name, "address": r.address, "phone": r.phone}


@router.get("/", response_model=List[dict])
def list_restaurants(db: Session = Depends(get_db)):
    rs = db.query(Restaurant).all()
    return [_payload(r) for r in rs]


@router.post("/", response_model=dict)
def create_restaurant(payload: RestaurantCreate, admin_id: int, db: Session = Depends(get_db)):
    _require_admin(db, admin_id)
    name = str(payload.name or "").strip()
    address = str(payload.address or "").strip()
    if not name or not address:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="name and address are required")
    row = Restaurant(name=name, address=address, phone=(str(payload.phone or "").strip() or None))
    db.add(row)
    db.commit()
    db.refresh(row)
    return _payload(row)


@router.put("/{restaurant_id}", response_model=dict)
def update_restaurant(restaurant_id: int, payload: RestaurantUpdate, admin_id: int, db: Session = Depends(get_db)):
    _require_admin(db, admin_id)
    row = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        row.name = str(data["name"] or "").strip() or row.name
    if "address" in data:
        row.address = str(data["address"] or "").strip() or row.address
    if "phone" in data:
        row.phone = str(data["phone"] or "").strip() or None
    db.add(row)
    db.commit()
    db.refresh(row)
    return _payload(row)


@router.delete("/{restaurant_id}", response_model=dict)
def delete_restaurant(restaurant_id: int, admin_id: int, db: Session = Depends(get_db)):
    _require_admin(db, admin_id)
    row = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")
    has_tables = db.query(Table.id).filter(Table.restaurant_id == restaurant_id).first()
    if has_tables:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Remove restaurant tables first")
    db.delete(row)
    db.commit()
    return {"ok": True, "id": int(restaurant_id)}


@router.get("/{restaurant_id}/tables", response_model=List[dict])
def list_tables(restaurant_id: int, db: Session = Depends(get_db)):
    tbls = db.query(Table).filter(Table.restaurant_id == restaurant_id).all()
    return [
        {
            "id": t.id,
            "restaurant_id": t.restaurant_id,
            "name": t.name,
            "seats": t.seats,
            "x": t.x,
            "y": t.y,
            "kind": getattr(t, "kind", None),
            "scale": getattr(t, "scale", None),
            "is_blocked": bool(getattr(t, "is_blocked", False)),
        }
        for t in tbls
    ]
