from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# ================ РАЗРЕШЕНИЯ И РОЛИ ================

class PermissionResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class PermissionCreate(BaseModel):
    name: str


class RoleResponse(BaseModel):
    id: int
    name: str
    permissions: List[PermissionResponse] = []

    class Config:
        from_attributes = True


class RoleCreate(BaseModel):
    name: str
    permission_ids: Optional[List[int]] = []


# ================ ПОЛЬЗОВАТЕЛИ ================

class UserResponse(BaseModel):
    id: int
    name: str
    role_id: int
    registration_date: datetime
    is_pro: bool = False
    role: Optional[RoleResponse] = None

    class Config:
        from_attributes = True


class UserRegister(BaseModel):
    name: str
    password: str
    role_id: int


class UserLogin(BaseModel):
    name: str
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
    role_id: Optional[int] = None


# ================ КАТЕГОРИИ ================

class CategoryResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class CategoryCreate(BaseModel):
    name: str


# ================ ТОВАРЫ ================

class GoodsResponse(BaseModel):
    id: int
    name: str
    code: str
    category_id: int
    import_date: datetime
    finish_date: Optional[datetime] = None
    category: Optional[CategoryResponse] = None

    class Config:
        from_attributes = True


class GoodsCreate(BaseModel):
    name: str
    code: str
    category_id: int
    finish_date: Optional[datetime] = None


class GoodsUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    category_id: Optional[int] = None
    finish_date: Optional[datetime] = None


# ================ ТОВАРЫ В КОРЗИНЕ ================

class GoodsBasketResponse(BaseModel):
    goods_id: int
    basket_id: int
    count: int
    goods: Optional[GoodsResponse] = None

    class Config:
        from_attributes = True


class GoodsBasketCreate(BaseModel):
    goods_id: int
    count: int = 1


class GoodsBasketUpdate(BaseModel):
    count: int


# ================ КОРЗИНА ================

class BasketResponse(BaseModel):
    id: int
    user_id: int
    goods_items: List[GoodsBasketResponse] = []

    class Config:
        from_attributes = True


class BasketCreate(BaseModel):
    user_id: int


# ================ СТАРЫЕ СХЕМЫ (для обратной совместимости) ================

class ReservationCreate(BaseModel):
    email: EmailStr
    phone: str
    date: str
    time: str
    guests: int
    special_requests: Optional[str] = None
    restaurant_id: Optional[int] = None
    table_id: Optional[int] = None
    table_ids: Optional[List[int]] = None


class RestaurantResponse(BaseModel):
    id: int
    name: str
    address: str

    class Config:
        from_attributes = True


class TableResponse(BaseModel):
    id: int
    restaurant_id: int
    name: str
    seats: int
    is_blocked: bool = False

    class Config:
        from_attributes = True


class ReservationResponse(BaseModel):
    id: int
    user_id: int
    email: str
    phone: str
    date: str
    time: str
    guests: int
    special_requests: Optional[str]
    is_confirmed: bool
    is_cancelled: bool = False
    restaurant_id: Optional[int]
    table_id: Optional[int]
    table_ids: List[int] = []
    created_at: datetime
    restaurant: Optional[RestaurantResponse] = None
    table: Optional[TableResponse] = None

    class Config:
        from_attributes = True


class ReservationUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    guests: Optional[int] = None
    special_requests: Optional[str] = None
    is_confirmed: Optional[bool] = None
    is_cancelled: Optional[bool] = None

