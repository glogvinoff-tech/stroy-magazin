from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import Goods, Category
from schemas import GoodsResponse, GoodsCreate, GoodsUpdate

router = APIRouter(prefix="/api/goods", tags=["goods"])


@router.post("/", response_model=GoodsResponse)
def create_goods(goods: GoodsCreate, db: Session = Depends(get_db)):
    """Создать новый товар"""
    
    # Проверяем, существует ли категория
    category = db.query(Category).filter(Category.id == goods.category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Категория не найдена"
        )
    
    # Проверяем, существует ли товар с таким кодом
    existing_goods = db.query(Goods).filter(Goods.code == goods.code).first()
    if existing_goods:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Товар с таким кодом уже существует"
        )
    
    db_goods = Goods(
        name=goods.name,
        code=goods.code,
        category_id=goods.category_id,
        finish_date=goods.finish_date
    )
    
    db.add(db_goods)
    db.commit()
    db.refresh(db_goods)
    
    return db_goods


@router.get("/{goods_id}", response_model=GoodsResponse)
def get_goods(goods_id: int, db: Session = Depends(get_db)):
    """Получить товар по ID"""
    goods = db.query(Goods).filter(Goods.id == goods_id).first()
    if not goods:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар не найден"
        )
    return goods


@router.get("/by-code/{code}", response_model=GoodsResponse)
def get_goods_by_code(code: str, db: Session = Depends(get_db)):
    """Получить товар по коду"""
    goods = db.query(Goods).filter(Goods.code == code).first()
    if not goods:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар с таким кодом не найден"
        )
    return goods


@router.get("/", response_model=list[GoodsResponse])
def get_all_goods(category_id: int = None, db: Session = Depends(get_db)):
    """Получить все товары, опционально фильтровать по категории"""
    query = db.query(Goods)
    
    if category_id:
        query = query.filter(Goods.category_id == category_id)
    
    goods_list = query.all()
    return goods_list


@router.get("/category/{category_id}", response_model=list[GoodsResponse])
def get_goods_by_category(category_id: int, db: Session = Depends(get_db)):
    """Получить все товары из категории"""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Категория не найдена"
        )
    
    goods_list = db.query(Goods).filter(Goods.category_id == category_id).all()
    return goods_list


@router.put("/{goods_id}", response_model=GoodsResponse)
def update_goods(
    goods_id: int,
    goods_update: GoodsUpdate,
    db: Session = Depends(get_db)
):
    """Обновить товар"""
    db_goods = db.query(Goods).filter(Goods.id == goods_id).first()
    if not db_goods:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар не найден"
        )
    
    # Если меняется код, проверяем уникальность
    if goods_update.code and goods_update.code != db_goods.code:
        existing = db.query(Goods).filter(Goods.code == goods_update.code).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Товар с таким кодом уже существует"
            )
    
    # Если меняется категория, проверяем её существование
    if goods_update.category_id and goods_update.category_id != db_goods.category_id:
        category = db.query(Category).filter(Category.id == goods_update.category_id).first()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Категория не найдена"
            )
    
    # Обновляем только переданные поля
    update_data = goods_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_goods, field, value)
    
    db.add(db_goods)
    db.commit()
    db.refresh(db_goods)
    
    return db_goods


@router.delete("/{goods_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goods(goods_id: int, db: Session = Depends(get_db)):
    """Удалить товар"""
    db_goods = db.query(Goods).filter(Goods.id == goods_id).first()
    if not db_goods:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар не найден"
        )
    
    db.delete(db_goods)
    db.commit()
    return None
