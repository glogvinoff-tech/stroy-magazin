from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import Reservation, User
from schemas import ReservationCreate, ReservationResponse, ReservationUpdate
from models import Table
import json

router = APIRouter(prefix="/api/reservations", tags=["reservations"])


@router.post("/", response_model=ReservationResponse)
def create_reservation(
    reservation: ReservationCreate,
    user_id: int,
    db: Session = Depends(get_db)
):
    """Создать новый заказ в совместимом старом формате"""
    
    # Проверяем, существует ли пользователь
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    # Table selection (supports PRO multi-table)
    table_ids = []
    if getattr(reservation, "table_ids", None):
        try:
            table_ids = [int(x) for x in (reservation.table_ids or []) if x is not None]
        except Exception:
            table_ids = []
    elif reservation.table_id:
        table_ids = [int(reservation.table_id)]

    # de-duplicate, keep order
    uniq = []
    for tid in table_ids:
        if tid not in uniq:
            uniq.append(tid)
    table_ids = uniq

    if len(table_ids) > 1 and not bool(getattr(user, "is_pro", False)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="PRO требуется для выбора нескольких позиций")

    if table_ids:
        if not reservation.restaurant_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нужно указать restaurant_id при выборе столов")

        # Validate tables exist and belong to restaurant
        tables = db.query(Table).filter(Table.id.in_(table_ids)).all()
        table_map = {t.id: t for t in tables}
        missing = [tid for tid in table_ids if tid not in table_map]
        if missing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Столики не найдены: {', '.join(map(str, missing))}")
        wrong = [tid for tid in table_ids if table_map[tid].restaurant_id != reservation.restaurant_id]
        if wrong:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверная позиция или магазин")

        blocked = [tid for tid in table_ids if bool(getattr(table_map[tid], "is_blocked", False))]
        if blocked:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Позиция временно недоступна")

        # Check if any of selected tables are already reserved at this time
        existing = db.query(Reservation).filter(
            Reservation.restaurant_id == reservation.restaurant_id,
            Reservation.date == reservation.date,
            Reservation.time == reservation.time
        ).all()
        occupied = set()
        for r in existing:
            if bool(getattr(r, "is_cancelled", False)):
                continue
            for tid in (getattr(r, "table_ids", None) or []):
                try:
                    occupied.add(int(tid))
                except Exception:
                    continue
        conflict = [tid for tid in table_ids if tid in occupied]
        if conflict:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Позиция уже занята на выбранное время")

    db_reservation = Reservation(
        user_id=user_id,
        email=reservation.email,
        phone=reservation.phone,
        date=reservation.date,
        time=reservation.time,
        guests=reservation.guests,
        special_requests=reservation.special_requests,
        restaurant_id=reservation.restaurant_id,
        table_id=(table_ids[0] if table_ids else reservation.table_id),
        table_ids_json=(json.dumps(table_ids, ensure_ascii=False) if table_ids else None),
    )
    
    db.add(db_reservation)
    db.commit()
    db.refresh(db_reservation)
    
    return db_reservation


@router.get("/{reservation_id}", response_model=ReservationResponse)
def get_reservation(reservation_id: int, db: Session = Depends(get_db)):
    """Получить информацию о заказе"""
    reservation = db.query(Reservation).filter(
        Reservation.id == reservation_id
    ).first()
    
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бронирование не найдено"
        )
    
    return reservation


@router.get("/user/{user_id}", response_model=list[ReservationResponse])
def get_user_reservations(user_id: int, db: Session = Depends(get_db)):
    """Получить все заказы пользователя"""
    
    # Проверяем, существует ли пользователь
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    reservations = db.query(Reservation).filter(
        Reservation.user_id == user_id
    ).all()
    
    return reservations


@router.get("/", response_model=list[ReservationResponse])
def get_all_reservations(db: Session = Depends(get_db)):
    """Получить все заказы"""
    reservations = db.query(Reservation).all()
    return reservations


@router.put("/{reservation_id}", response_model=ReservationResponse)
def update_reservation(
    reservation_id: int,
    reservation_update: ReservationUpdate,
    db: Session = Depends(get_db)
):
    """Обновить заказ"""
    
    db_reservation = db.query(Reservation).filter(
        Reservation.id == reservation_id
    ).first()
    
    if not db_reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бронирование не найдено"
        )
    
    # Обновляем только переданные поля
    update_data = reservation_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_reservation, field, value)
    
    db.add(db_reservation)
    db.commit()
    db.refresh(db_reservation)
    
    return db_reservation


@router.delete("/{reservation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reservation(reservation_id: int, db: Session = Depends(get_db)):
    """Удалить заказ"""
    
    db_reservation = db.query(Reservation).filter(
        Reservation.id == reservation_id
    ).first()
    
    if not db_reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бронирование не найдено"
        )
    
    db.delete(db_reservation)
    db.commit()
    
    return None
