from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import Basket, User, Goods, GoodsBasket
from schemas import BasketResponse, BasketCreate, GoodsBasketResponse, GoodsBasketCreate, GoodsBasketUpdate

router = APIRouter(prefix="/api/baskets", tags=["baskets"])


@router.post("/", response_model=BasketResponse)
def create_basket(basket: BasketCreate, db: Session = Depends(get_db)):
    """Создать корзину для пользователя"""
    
    # Проверяем, существует ли пользователь
    user = db.query(User).filter(User.id == basket.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    # Проверяем, не существует ли уже корзина для этого пользователя
    existing_basket = db.query(Basket).filter(Basket.user_id == basket.user_id).first()
    if existing_basket:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Корзина для этого пользователя уже существует"
        )
    
    db_basket = Basket(user_id=basket.user_id)
    db.add(db_basket)
    db.commit()
    db.refresh(db_basket)
    
    return db_basket


@router.get("/{basket_id}", response_model=BasketResponse)
def get_basket(basket_id: int, db: Session = Depends(get_db)):
    """Получить корзину по ID"""
    basket = db.query(Basket).filter(Basket.id == basket_id).first()
    if not basket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Корзина не найдена"
        )
    return basket


@router.get("/user/{user_id}", response_model=BasketResponse)
def get_user_basket(user_id: int, db: Session = Depends(get_db)):
    """Получить корзину конкретного пользователя"""
    
    # Проверяем, существует ли пользователь
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    basket = db.query(Basket).filter(Basket.user_id == user_id).first()
    if not basket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Корзина не найдена"
        )
    return basket


@router.delete("/{basket_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_basket(basket_id: int, db: Session = Depends(get_db)):
    """Удалить корзину"""
    basket = db.query(Basket).filter(Basket.id == basket_id).first()
    if not basket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Корзина не найдена"
        )
    
    db.delete(basket)
    db.commit()
    return None


# ================ ТОВАРЫ В КОРЗИНЕ ================

@router.post("/{basket_id}/items", response_model=GoodsBasketResponse)
def add_goods_to_basket(
    basket_id: int,
    item: GoodsBasketCreate,
    db: Session = Depends(get_db)
):
    """Добавить товар в корзину"""
    
    # Проверяем, существует ли корзина
    basket = db.query(Basket).filter(Basket.id == basket_id).first()
    if not basket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Корзина не найдена"
        )
    
    # Проверяем, существует ли товар
    goods = db.query(Goods).filter(Goods.id == item.goods_id).first()
    if not goods:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар не найден"
        )
    
    # Проверяем, не добавлен ли уже этот товар в корзину
    existing_item = db.query(GoodsBasket).filter(
        GoodsBasket.basket_id == basket_id,
        GoodsBasket.goods_id == item.goods_id
    ).first()
    
    if existing_item:
        # Увеличиваем количество
        existing_item.count += item.count
        db.add(existing_item)
        db.commit()
        db.refresh(existing_item)
        return existing_item
    
    # Создаем новую запись
    db_item = GoodsBasket(
        goods_id=item.goods_id,
        basket_id=basket_id,
        count=item.count
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    return db_item


@router.get("/{basket_id}/items", response_model=list[GoodsBasketResponse])
def get_basket_items(basket_id: int, db: Session = Depends(get_db)):
    """Получить все товары в корзине"""
    
    # Проверяем, существует ли корзина
    basket = db.query(Basket).filter(Basket.id == basket_id).first()
    if not basket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Корзина не найдена"
        )
    
    items = db.query(GoodsBasket).filter(GoodsBasket.basket_id == basket_id).all()
    return items


@router.get("/{basket_id}/items/{goods_id}", response_model=GoodsBasketResponse)
def get_basket_item(basket_id: int, goods_id: int, db: Session = Depends(get_db)):
    """Получить конкретный товар в корзине"""
    
    item = db.query(GoodsBasket).filter(
        GoodsBasket.basket_id == basket_id,
        GoodsBasket.goods_id == goods_id
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар не найден в корзине"
        )
    
    return item


@router.put("/{basket_id}/items/{goods_id}", response_model=GoodsBasketResponse)
def update_basket_item(
    basket_id: int,
    goods_id: int,
    item_update: GoodsBasketUpdate,
    db: Session = Depends(get_db)
):
    """Обновить количество товара в корзине"""
    
    item = db.query(GoodsBasket).filter(
        GoodsBasket.basket_id == basket_id,
        GoodsBasket.goods_id == goods_id
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар не найден в корзине"
        )
    
    if item_update.count <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Количество должно быть больше нуля"
        )
    
    item.count = item_update.count
    db.add(item)
    db.commit()
    db.refresh(item)
    
    return item


@router.delete("/{basket_id}/items/{goods_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_goods_from_basket(basket_id: int, goods_id: int, db: Session = Depends(get_db)):
    """Удалить товар из корзины"""
    
    item = db.query(GoodsBasket).filter(
        GoodsBasket.basket_id == basket_id,
        GoodsBasket.goods_id == goods_id
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар не найден в корзине"
        )
    
    db.delete(item)
    db.commit()
    
    return None


@router.delete("/{basket_id}/clear", status_code=status.HTTP_204_NO_CONTENT)
def clear_basket(basket_id: int, db: Session = Depends(get_db)):
    """Очистить корзину (удалить все товары)"""
    
    # Проверяем, существует ли корзина
    basket = db.query(Basket).filter(Basket.id == basket_id).first()
    if not basket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Корзина не найдена"
        )
    
    # Удаляем все товары из корзины
    db.query(GoodsBasket).filter(GoodsBasket.basket_id == basket_id).delete()
    db.commit()
    
    return None
