from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import Reservation, User, Role, Table
from schemas import UserResponse, UserUpdate

router = APIRouter(prefix="/api/admin", tags=["admin"])


class TableUpdate(BaseModel):
    is_blocked: bool


class TableLayoutUpdate(BaseModel):
    x: int
    y: int


class TableMetaUpdate(BaseModel):
    name: str | None = None
    seats: int | None = None
    kind: str | None = None
    scale: float | None = None


class TableCreate(BaseModel):
    restaurant_id: int
    name: str
    seats: int = 2
    x: int | None = None
    y: int | None = None
    kind: str | None = None
    scale: float | None = None
    is_blocked: bool = False


def get_current_admin(user_id: int, db: Session = Depends(get_db)) -> User:
    """Проверить, что текущий пользователь - администратор"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    role_name = None
    try:
        role_name = getattr(user.role, "name", None)
    except Exception:
        role_name = None
    if not role_name and getattr(user, "role_id", None):
        role = db.query(Role).filter(Role.id == user.role_id).first()
        role_name = getattr(role, "name", None) if role else None
    if role_name != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав. Требуется роль администратора"
        )
    return user


@router.put("/tables/{table_id}", response_model=dict)
def update_table_admin(
    table_id: int,
    payload: TableUpdate,
    admin_id: int,
    db: Session = Depends(get_db)
):
    """Заблокировать/разблокировать товарную позицию (только для админа)"""
    get_current_admin(admin_id, db)

    tbl = db.query(Table).filter(Table.id == table_id).first()
    if not tbl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Столик не найден")

    tbl.is_blocked = bool(payload.is_blocked)
    db.add(tbl)
    db.commit()
    db.refresh(tbl)

    return {
        "id": tbl.id,
        "restaurant_id": tbl.restaurant_id,
        "name": tbl.name,
        "seats": tbl.seats,
        "x": tbl.x,
        "y": tbl.y,
        "is_blocked": bool(getattr(tbl, "is_blocked", False)),
    }


@router.put("/tables/{table_id}/layout", response_model=dict)
def update_table_layout_admin(
    table_id: int,
    payload: TableLayoutUpdate,
    admin_id: int,
    db: Session = Depends(get_db)
):
    """Изменить позицию столика на плане (только для админа)"""
    get_current_admin(admin_id, db)

    tbl = db.query(Table).filter(Table.id == table_id).first()
    if not tbl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Столик не найден")

    tbl.x = int(payload.x)
    tbl.y = int(payload.y)
    db.add(tbl)
    db.commit()
    db.refresh(tbl)

    return {
        "id": tbl.id,
        "restaurant_id": tbl.restaurant_id,
        "name": tbl.name,
        "seats": tbl.seats,
        "x": tbl.x,
        "y": tbl.y,
        "is_blocked": bool(getattr(tbl, "is_blocked", False)),
    }


@router.put("/tables/{table_id}/meta", response_model=dict)
def update_table_meta_admin(
    table_id: int,
    payload: TableMetaUpdate,
    admin_id: int,
    db: Session = Depends(get_db)
):
    """Изменить параметры столика (название/места/тип/масштаб) (только для админа)"""
    get_current_admin(admin_id, db)

    tbl = db.query(Table).filter(Table.id == table_id).first()
    if not tbl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Столик не найден")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        tbl.name = str(data["name"])
    if "seats" in data and data["seats"] is not None:
        seats = int(data["seats"])
        if seats < 1 or seats > 12:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректное число мест")
        tbl.seats = seats
    if "kind" in data:
        kind = data.get("kind")
        if kind is not None:
            kind_s = str(kind).strip().lower()
            if kind_s == "":
                tbl.kind = None
            else:
                if kind_s not in {"standard", "round", "booth", "bar"}:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный тип столика")
                tbl.kind = kind_s
        else:
            tbl.kind = None
    if "scale" in data:
        sc = data.get("scale")
        if sc is None:
            tbl.scale = None
        else:
            val = float(sc)
            if val < 0.6 or val > 2.0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный масштаб")
            tbl.scale = val

    db.add(tbl)
    db.commit()
    db.refresh(tbl)
    return {
        "id": tbl.id,
        "restaurant_id": tbl.restaurant_id,
        "name": tbl.name,
        "seats": tbl.seats,
        "x": tbl.x,
        "y": tbl.y,
        "kind": getattr(tbl, "kind", None),
        "scale": getattr(tbl, "scale", None),
        "is_blocked": bool(getattr(tbl, "is_blocked", False)),
    }


@router.post("/tables", response_model=dict)
def create_table_admin(
    payload: TableCreate,
    admin_id: int,
    db: Session = Depends(get_db)
):
    """Создать столик (только для админа)"""
    get_current_admin(admin_id, db)

    rest = int(payload.restaurant_id)
    seats = int(payload.seats or 2)
    if seats < 1 or seats > 12:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректное число мест")

    kind = payload.kind
    if kind is not None:
        kind_s = str(kind).strip().lower()
        if kind_s == "":
            kind_s = None
        elif kind_s not in {"standard", "round", "booth", "bar"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный тип столика")
        kind = kind_s

    sc = payload.scale
    if sc is not None:
        sc = float(sc)
        if sc < 0.6 or sc > 2.0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный масштаб")

    tbl = Table(
        restaurant_id=rest,
        name=str(payload.name or "").strip() or "Table",
        seats=seats,
        x=payload.x,
        y=payload.y,
        kind=kind,
        scale=sc,
        is_blocked=bool(payload.is_blocked),
    )
    db.add(tbl)
    db.commit()
    db.refresh(tbl)
    return {
        "id": tbl.id,
        "restaurant_id": tbl.restaurant_id,
        "name": tbl.name,
        "seats": tbl.seats,
        "x": tbl.x,
        "y": tbl.y,
        "kind": getattr(tbl, "kind", None),
        "scale": getattr(tbl, "scale", None),
        "is_blocked": bool(getattr(tbl, "is_blocked", False)),
    }


@router.delete("/tables/{table_id}", response_model=dict)
def delete_table_admin(
    table_id: int,
    admin_id: int,
    db: Session = Depends(get_db)
):
    """Удалить столик (только для админа)"""
    get_current_admin(admin_id, db)

    tbl = db.query(Table).filter(Table.id == table_id).first()
    if not tbl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Столик не найден")

    used = db.query(Reservation).filter(Reservation.table_id == table_id).first()
    if used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить товарную позицию: она используется в заказах"
        )

    db.delete(tbl)
    db.commit()
    return {"ok": True, "id": int(table_id)}


@router.delete("/restaurants/{restaurant_id}/tables", response_model=dict)
def delete_restaurant_tables_admin(
    restaurant_id: int,
    admin_id: int,
    db: Session = Depends(get_db)
):
    """Удалить все товарные позиции магазина (только для админа)"""
    get_current_admin(admin_id, db)

    table_ids = [t.id for t in db.query(Table.id).filter(Table.restaurant_id == restaurant_id).all()]
    if not table_ids:
        return {"ok": True, "deleted": 0}

    used = db.query(Reservation).filter(Reservation.table_id.in_(table_ids)).first()
    if used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить товарные позиции: они используются в заказах"
        )

    deleted = db.query(Table).filter(Table.restaurant_id == restaurant_id).delete(synchronize_session=False)
    db.commit()
    return {"ok": True, "deleted": int(deleted or 0)}


# ================ УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ================

@router.get("/users", response_model=list[UserResponse])
def get_all_users_admin(
    admin_id: int,
    db: Session = Depends(get_db)
):
    """Получить всех пользователей (только для админа)"""
    get_current_admin(admin_id, db)
    
    users = db.query(User).all()
    return users


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user_admin(
    user_id: int,
    admin_id: int,
    db: Session = Depends(get_db)
):
    """Получить информацию о пользователе (только для админа)"""
    get_current_admin(admin_id, db)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user_admin(
    user_id: int,
    user_update: UserUpdate,
    admin_id: int,
    db: Session = Depends(get_db)
):
    """Обновить информацию о пользователе (только для админа)"""
    get_current_admin(admin_id, db)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    # Обновляем только переданные поля
    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user


@router.post("/users/{user_id}/role/{role}")
def set_user_role_admin(
    user_id: int,
    role: str,
    admin_id: int,
    db: Session = Depends(get_db)
):
    """Назначить роль пользователю (только для админа)"""
    get_current_admin(admin_id, db)
    
    # Проверяем корректность роли
    if role not in ["user", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверная роль. Допустимые значения: 'user', 'admin'"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    target_role = db.query(Role).filter(Role.name == role).first()
    if not target_role:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Роль не найдена")
    user.role_id = target_role.id
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return {"message": f"Роль пользователя изменена на {role}", "user": user}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_admin(
    user_id: int,
    admin_id: int,
    db: Session = Depends(get_db)
):
    """Удалить пользователя (только для админа)"""
    get_current_admin(admin_id, db)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    # Удаляем все заказы пользователя
    db.query(Reservation).filter(
        Reservation.user_id == user_id
    ).delete()
    
    # Удаляем пользователя
    db.delete(user)
    db.commit()
    
    return None
