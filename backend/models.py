from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Float
from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import json


# ================ Р’Р•РўР’Р¬ Р РђР—Р Р•РЁР•РќРР™ Р Р РћР›Р•Р™ ================

class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    
    # РћС‚РЅРѕС€РµРЅРёСЏ
    roles = relationship("Role", secondary="role_permissions", back_populates="permissions")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    
    # РћС‚РЅРѕС€РµРЅРёСЏ
    users = relationship("User", back_populates="role")
    permissions = relationship("Permission", secondary="role_permissions", back_populates="roles")


# ================ Р’Р•РўР’Р¬ РџРћР›Р¬Р—РћР’РђРўР•Р›Р•Р™ ================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    # New auth schema (used by current backend routes)
    name = Column(String, nullable=True)
    password = Column(String, nullable=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    registration_date = Column(DateTime(timezone=True), nullable=True, server_default=func.now())
    # Legacy schema columns that still exist in app.db and are NOT NULL there.
    email = Column(String, nullable=True)
    username = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    birth_date = Column(String, nullable=True)
    email_verified = Column(Boolean, nullable=True, default=False)
    vk_id = Column(String, nullable=True, index=True)
    vk_username = Column(String, nullable=True)
    vk_avatar_url = Column(String, nullable=True)
    is_pro = Column(Boolean, nullable=True, default=False)
    is_active = Column(Boolean, nullable=True, default=True)
    created_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())
    
    # РћС‚РЅРѕС€РµРЅРёСЏ
    role = relationship("Role", back_populates="users")
    basket = relationship("Basket", uselist=False, back_populates="user", cascade="all, delete-orphan")


class Basket(Base):
    __tablename__ = "baskets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    
    # РћС‚РЅРѕС€РµРЅРёСЏ
    user = relationship("User", back_populates="basket")
    goods_items = relationship("GoodsBasket", back_populates="basket", cascade="all, delete-orphan")


# ================ Р’Р•РўР’Р¬ РўРћР’РђР РћР’ ================

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    
    # РћС‚РЅРѕС€РµРЅРёСЏ
    goods = relationship("Goods", back_populates="category")


class Goods(Base):
    __tablename__ = "goods"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    import_date = Column(DateTime(timezone=True), server_default=func.now())
    finish_date = Column(DateTime(timezone=True), nullable=True)
    
    # РћС‚РЅРѕС€РµРЅРёСЏ
    category = relationship("Category", back_populates="goods")
    basket_items = relationship("GoodsBasket", back_populates="goods", cascade="all, delete-orphan")


class GoodsBasket(Base):
    __tablename__ = "goods_baskets"

    goods_id = Column(Integer, ForeignKey("goods.id"), primary_key=True, index=True)
    basket_id = Column(Integer, ForeignKey("baskets.id"), primary_key=True, index=True)
    count = Column(Integer, default=1, nullable=False)
    
    # РћС‚РЅРѕС€РµРЅРёСЏ
    goods = relationship("Goods", back_populates="basket_items")
    basket = relationship("Basket", back_populates="goods_items")


# ================ РўРђР‘Р›РР¦Рђ РЎР’РЇР—Р•Р™ Р РћР›Р•Р™ Р Р РђР—Р Р•РЁР•РќРР™ ================

from sqlalchemy import Table

role_permissions = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', Integer, ForeignKey('roles.id'), primary_key=True),
    Column('permission_id', Integer, ForeignKey('permissions.id'), primary_key=True)
)


# ================ РЎРўРђР Р«Р• РњРћР”Р•Р›Р (РґР»СЏ РѕР±СЂР°С‚РЅРѕР№ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё) ================

class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    date = Column(String, nullable=False)
    time = Column(String, nullable=False)
    guests = Column(Integer, nullable=False)
    special_requests = Column(Text, nullable=True)
    is_confirmed = Column(Boolean, default=False)
    is_cancelled = Column(Boolean, default=False)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=True, index=True)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=True, index=True)
    # JSON array of item ids kept for compatibility with older order flows.
    table_ids_json = Column("table_ids", Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # РћС‚РЅРѕС€РµРЅРёСЏ
    restaurant = relationship("Restaurant", backref="reservations")
    table = relationship("Table", backref="reservations")

    @property
    def table_ids(self):
        raw = self.table_ids_json
        if raw:
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    out = []
                    for x in parsed:
                        try:
                            v = int(x)
                        except Exception:
                            continue
                        if v not in out:
                            out.append(v)
                    return out
            except Exception:
                pass
        if self.table_id:
            return [self.table_id]
        return []


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    items_json = Column(Text, nullable=False)
    total = Column(Integer, nullable=False, default=0)
    fulfillment = Column(String, nullable=True)  # delivery | pickup
    fulfillment_time = Column(String, nullable=True)  # datetime-local string
    restaurant_id = Column(Integer, nullable=True, index=True)
    address = Column(String, nullable=True)
    payment = Column(String, nullable=True)
    comment = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="pending")
    stock_reserved = Column(Boolean, nullable=False, default=False)
    stock_committed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())

    user = relationship("User")


class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Table(Base):
    __tablename__ = "tables"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, index=True, nullable=False)
    name = Column(String, nullable=False)
    seats = Column(Integer, nullable=False, default=2)
    x = Column(Integer, nullable=True)
    y = Column(Integer, nullable=True)
    kind = Column(String, nullable=True)
    scale = Column(Float, nullable=True)
    is_blocked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EmailVerificationCode(Base):
    __tablename__ = "email_verification_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    email = Column(String, nullable=False, index=True)
    code = Column(String, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SupportThread(Base):
    __tablename__ = "support_threads"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="open")
    last_message_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())
    created_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())

    user = relationship("User")
    messages = relationship("SupportMessage", back_populates="thread", cascade="all, delete-orphan")


class SupportMessage(Base):
    __tablename__ = "support_messages"

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey("support_threads.id"), nullable=False, index=True)
    sender_role = Column(String, nullable=False)  # user|admin
    sender_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())

    thread = relationship("SupportThread", back_populates="messages")
    sender = relationship("User")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    cat = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False, index=True)
    price = Column(Integer, nullable=False, default=0)
    discount_percent = Column(Integer, nullable=False, default=0)
    weight = Column(String, nullable=True)
    badge = Column(String, nullable=True)
    tags_json = Column(Text, nullable=True)
    img = Column(String, nullable=True)
    gallery_json = Column(Text, nullable=True)
    desc = Column(Text, nullable=True)
    ingr = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())


class WarehouseStock(Base):
    __tablename__ = "warehouse_stocks"
    __table_args__ = (UniqueConstraint("menu_item_id", "restaurant_id", name="uq_warehouse_item_restaurant"),)

    id = Column(Integer, primary_key=True, index=True)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False, default=0)
    reserved = Column(Integer, nullable=False, default=0)
    min_quantity = Column(Integer, nullable=False, default=5)
    sku = Column(String, nullable=True)
    barcode = Column(String, nullable=True)
    data_matrix = Column(String, nullable=True)
    batch = Column(String, nullable=True)
    location = Column(String, nullable=True)
    storage_condition = Column(String, nullable=True)
    supplier = Column(String, nullable=True)
    expires_at = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())

    item = relationship("MenuItem")
    restaurant = relationship("Restaurant")


class WarehouseMovement(Base):
    __tablename__ = "warehouse_movements"

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("warehouse_stocks.id"), nullable=True, index=True)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    delta = Column(Integer, nullable=False, default=0)
    quantity_after = Column(Integer, nullable=False, default=0)
    reason = Column(String, nullable=True)
    document_no = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())

    stock = relationship("WarehouseStock")
    item = relationship("MenuItem")
    restaurant = relationship("Restaurant")
    user = relationship("User")


class WarehouseDocument(Base):
    __tablename__ = "warehouse_documents"

    id = Column(Integer, primary_key=True, index=True)
    kind = Column(String, nullable=False, index=True)  # receipt|writeoff|inventory
    document_no = Column(String, nullable=True)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False, default=0)
    quantity_before = Column(Integer, nullable=False, default=0)
    quantity_after = Column(Integer, nullable=False, default=0)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())

    item = relationship("MenuItem")
    restaurant = relationship("Restaurant")
    user = relationship("User")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    image_url = Column(String, nullable=True)
    is_private = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=True, index=True)
    author_name = Column(String, nullable=False, default="Гость")
    rating = Column(Integer, nullable=False, default=5)
    text = Column(Text, nullable=False)
    admin_reply = Column(Text, nullable=True)
    is_featured = Column(Boolean, nullable=False, default=False)
    order_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True, server_default=func.now())

    user = relationship("User")
    item = relationship("MenuItem")
