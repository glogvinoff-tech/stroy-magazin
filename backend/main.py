from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from database import engine, Base
import auth_new as auth
import restaurants
import admin
import support
import menu
import events
import orders
import admin_orders
import reviews as reviews_module
import uploads
import warehouse
import models
import os
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import SessionLocal
from urllib.parse import urlparse
from typing import Optional
from utils import hash_password
from datetime import datetime
import json


def load_dotenv_files():
    candidates = [
        Path(__file__).resolve().parent.parent / ".env",
        Path(__file__).resolve().parent / ".env",
    ]
    for env_path in candidates:
        if not env_path.exists():
            continue
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


load_dotenv_files()


def seed_restaurants():
    db: Session = SessionLocal()
    try:
        # Создаем дефолтные роли если их нет
        from models import Restaurant, Table, Role, User
        
        # Проверяем и создаем роли
        default_roles = ["user", "admin", "manager"]
        for role_name in default_roles:
            existing_role = db.query(Role).filter(Role.name == role_name).first()
            if not existing_role:
                new_role = Role(name=role_name)
                db.add(new_role)
        db.commit()

        # Создаем дефолтного админа (для разработки/демо)
        admin_username = (os.getenv("ADMIN_USERNAME") or "admin").strip()
        admin_password = (os.getenv("ADMIN_PASSWORD") or "admin123").strip()
        if admin_username and admin_password:
            existing_admin = db.query(User).filter((User.name == admin_username) | (User.username == admin_username)).first()
            if not existing_admin:
                admin_role = db.query(Role).filter(Role.name == "admin").first()
                role_id = admin_role.id if admin_role else 2
                hashed = hash_password(admin_password)
                db.add(User(
                    name=admin_username,
                    username=admin_username,
                    email=f"{admin_username}@local",
                    password=hashed,
                    hashed_password=hashed,
                    role_id=role_id,
                    email_verified=True,
                    is_pro=True,
                ))
                db.commit()
        
        # Адреса магазинов и товары на плане управляются только из админ-панели.
        return

        # If restaurants already exist, keep them; tables are managed via admin panel.
        if db.query(Restaurant).count() > 0:
            return

        addresses = [
            "г. Москва, ул. Тверская, 15",
            "г. Москва, ул. Арбат, 12",
            "г. Москва, просп. Мира, 45",
            "г. Москва, наб. Тараса Шевченко, 3",
            "г. Москва, ул. Новый Арбат, 21",
            "г. Москва, Ленинградский просп., 10",
            "г. Москва, ул. Покровка, 18",
            "г. Москва, ул. Большая Никитская, 7",
            "г. Москва, Кутузовский просп., 30",
            "г. Москва, ул. Остоженка, 25"
        ]

        # Table layout is managed from the admin panel; no default tables are seeded.

        for i, addr in enumerate(addresses, start=1):
            r = Restaurant(name=f"СтройМагазин {i}", address=addr, phone="+7 (495) 111-22-33")
            db.add(r)
            db.flush()

        db.commit()
    finally:
        db.close()

# Создаем таблицы в БД
def migrate_legacy_users_schema():
    db: Session = SessionLocal()
    try:
        user_cols = {
            row[1] for row in db.execute(text("PRAGMA table_info(users)")).fetchall()
        }
        if not user_cols:
            return

        if "name" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN name VARCHAR"))
        if "password" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN password VARCHAR"))
        if "role_id" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN role_id INTEGER"))
        if "registration_date" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN registration_date DATETIME"))
        if "birth_date" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN birth_date VARCHAR"))
        if "email_verified" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN"))
        if "vk_id" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN vk_id VARCHAR"))
        if "vk_username" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN vk_username VARCHAR"))
        if "vk_avatar_url" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN vk_avatar_url VARCHAR"))
        if "is_pro" not in user_cols:
            db.execute(text("ALTER TABLE users ADD COLUMN is_pro BOOLEAN"))

        user_cols = {
            row[1] for row in db.execute(text("PRAGMA table_info(users)")).fetchall()
        }

        if "name" in user_cols:
            if "username" in user_cols:
                db.execute(text("UPDATE users SET name = COALESCE(name, username) WHERE name IS NULL OR TRIM(name) = ''"))
            if "email" in user_cols:
                db.execute(text("UPDATE users SET name = COALESCE(name, email) WHERE name IS NULL OR TRIM(name) = ''"))

        if "password" in user_cols and "hashed_password" in user_cols:
            db.execute(text("UPDATE users SET password = COALESCE(password, hashed_password) WHERE password IS NULL OR TRIM(password) = ''"))

        if "role_id" in user_cols:
            db.execute(text("UPDATE users SET role_id = 1 WHERE role_id IS NULL"))
        if "email_verified" in user_cols:
            db.execute(text("UPDATE users SET email_verified = COALESCE(email_verified, 0)"))
        if "is_pro" in user_cols:
            db.execute(text("UPDATE users SET is_pro = COALESCE(is_pro, 0)"))

        if "registration_date" in user_cols:
            if "created_at" in user_cols:
                db.execute(text("UPDATE users SET registration_date = COALESCE(registration_date, created_at, CURRENT_TIMESTAMP) WHERE registration_date IS NULL"))
            else:
                db.execute(text("UPDATE users SET registration_date = COALESCE(registration_date, CURRENT_TIMESTAMP) WHERE registration_date IS NULL"))

        db.commit()
    finally:
        db.close()


def migrate_legacy_tables_schema():
    db: Session = SessionLocal()
    try:
        cols = {
            row[1] for row in db.execute(text("PRAGMA table_info(tables)")).fetchall()
        }
        if not cols:
            return
        changed = False
        if "is_blocked" not in cols:
            db.execute(text("ALTER TABLE tables ADD COLUMN is_blocked BOOLEAN"))
            changed = True
        if "kind" not in cols:
            db.execute(text("ALTER TABLE tables ADD COLUMN kind TEXT"))
            changed = True
        if "scale" not in cols:
            db.execute(text("ALTER TABLE tables ADD COLUMN scale REAL"))
            changed = True

        if changed:
            db.commit()
            cols = {
                row[1] for row in db.execute(text("PRAGMA table_info(tables)")).fetchall()
            }
        if "is_blocked" in cols:
            db.execute(text("UPDATE tables SET is_blocked = COALESCE(is_blocked, 0)"))
        db.commit()
    finally:
        db.close()


def migrate_legacy_menu_items_schema():
    db: Session = SessionLocal()
    try:
        cols = {
            row[1] for row in db.execute(text("PRAGMA table_info(menu_items)")).fetchall()
        }
        if not cols:
            return

        changed = False
        if "discount_percent" not in cols:
            db.execute(text("ALTER TABLE menu_items ADD COLUMN discount_percent INTEGER"))
            changed = True
        if "gallery_json" not in cols:
            db.execute(text("ALTER TABLE menu_items ADD COLUMN gallery_json TEXT"))
            changed = True

        if changed:
            db.commit()
            cols = {
                row[1] for row in db.execute(text("PRAGMA table_info(menu_items)")).fetchall()
            }

        if "discount_percent" in cols:
            db.execute(text("UPDATE menu_items SET discount_percent = COALESCE(discount_percent, 0)"))

        db.commit()
    finally:
        db.close()


def migrate_legacy_orders_schema():
    db: Session = SessionLocal()
    try:
        cols = {
            row[1] for row in db.execute(text("PRAGMA table_info(orders)")).fetchall()
        }
        if not cols:
            return
        changed = False
        if "restaurant_id" not in cols:
            db.execute(text("ALTER TABLE orders ADD COLUMN restaurant_id INTEGER"))
            changed = True
        if "status" not in cols:
            db.execute(text("ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'"))
            changed = True
        if "stock_reserved" not in cols:
            db.execute(text("ALTER TABLE orders ADD COLUMN stock_reserved BOOLEAN NOT NULL DEFAULT 0"))
            changed = True
        if "stock_committed" not in cols:
            db.execute(text("ALTER TABLE orders ADD COLUMN stock_committed BOOLEAN NOT NULL DEFAULT 0"))
            changed = True
        if changed:
            db.commit()
    finally:
        db.close()


def migrate_legacy_reviews_schema():
    db: Session = SessionLocal()
    try:
        cols = {
            row[1] for row in db.execute(text("PRAGMA table_info(reviews)")).fetchall()
        }
        if not cols:
            return
        if "item_id" not in cols:
            db.execute(text("ALTER TABLE reviews ADD COLUMN item_id INTEGER"))
            db.commit()
    finally:
        db.close()


def seed_menu_items():
    return
    db: Session = SessionLocal()
    try:
        from models import MenuItem
        if db.query(MenuItem).count() > 0:
            return
        seed_path = Path(__file__).resolve().parent / "seed_menu.json"
        if not seed_path.exists():
            return
        try:
            data = json.loads(seed_path.read_text(encoding="utf-8"))
        except Exception:
            data = []
        if not isinstance(data, list) or not data:
            return

        for raw in data:
            if not isinstance(raw, dict):
                continue
            tags = raw.get("tags") if isinstance(raw.get("tags"), list) else []
            db.add(MenuItem(
                id=raw.get("id"),
                cat=str(raw.get("cat") or "").strip() or "Другое",
                name=str(raw.get("name") or "").strip() or "Блюдо",
                price=int(raw.get("price") or 0),
                weight=str(raw.get("weight") or "").strip() or None,
                badge=str(raw.get("badge") or "").strip() or None,
                tags_json=json.dumps(tags, ensure_ascii=False),
                img=str(raw.get("img") or "").strip() or None,
                desc=str(raw.get("desc") or "").strip() or None,
                ingr=str(raw.get("ingr") or "").strip() or None,
                is_active=True,
                updated_at=datetime.utcnow(),
            ))
        db.commit()
    finally:
        db.close()


def seed_events():
    return
    db: Session = SessionLocal()
    try:
        from models import Event
        if db.query(Event).count() > 0:
            return
        now = datetime.utcnow()
        db.add_all([
            Event(
                title="Гастро‑ужин с шефом",
                description="Закрытый сет из 6 подач + винное сопровождение. Места ограничены.",
                starts_at=now,
                image_url="https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba",
                is_private=True,
            ),
            Event(
                title="Весеннее меню — превью",
                description="Дегустация новых блюд и авторских напитков. Открыто для всех гостей.",
                starts_at=now,
                image_url="https://images.unsplash.com/photo-1540189549336-e6e99c3679fe",
                is_private=False,
            ),
        ])
        db.commit()
    finally:
        db.close()


def migrate_legacy_warehouse_schema():
    db: Session = SessionLocal()
    try:
        cols = {row[1] for row in db.execute(text("PRAGMA table_info(warehouse_stocks)")).fetchall()}
        if not cols:
            return
        for name in ["barcode", "data_matrix", "batch", "storage_condition", "expires_at"]:
            if name not in cols:
                db.execute(text(f"ALTER TABLE warehouse_stocks ADD COLUMN {name} VARCHAR"))
        db.commit()
    finally:
        db.close()


Base.metadata.create_all(bind=engine)
migrate_legacy_users_schema()
migrate_legacy_tables_schema()
migrate_legacy_menu_items_schema()
migrate_legacy_orders_schema()
migrate_legacy_reviews_schema()
migrate_legacy_warehouse_schema()

# Создаем приложение FastAPI
app = FastAPI(
    title="Building Store API",
    description="API строительного магазина с функциями регистрации и заказов",
    version="1.0.0"
)

# Добавляем CORS middleware для работы с фронтендом
def _csv(value: str) -> list[str]:
    return [v.strip() for v in (value or "").split(",") if v.strip()]


def _origin_from_url(value: str) -> Optional[str]:
    raw = (value or "").strip().rstrip("/")
    if not raw:
        return None
    if raw == "null":
        return "null"
    parsed = urlparse(raw)
    if not parsed.scheme or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


frontend_origins = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
)
allow_origins = _csv(frontend_origins)

frontend_public_origin = _origin_from_url(os.getenv("FRONTEND_PUBLIC_URL", ""))
if frontend_public_origin and frontend_public_origin not in allow_origins:
    allow_origins.append(frontend_public_origin)

cors_allow_all = (os.getenv("CORS_ALLOW_ALL") or "").strip().lower() in {"1", "true", "yes", "on"}
if "*" in allow_origins:
    cors_allow_all = True

frontend_origin_regex = (os.getenv("FRONTEND_ORIGIN_REGEX") or "").strip()
if not frontend_origin_regex:
    # Allow any localhost port by default (handy for "serve", Vite, etc.)
    frontend_origin_regex = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"

cors_allow_credentials = (os.getenv("CORS_ALLOW_CREDENTIALS") or "").strip().lower() in {"1", "true", "yes", "on"}
if cors_allow_all:
    allow_origins = ["*"]
    frontend_origin_regex = None
    cors_allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=frontend_origin_regex,
    allow_credentials=cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем роутеры
app.include_router(auth.router)
app.include_router(restaurants.router)
app.include_router(admin.router)
app.include_router(support.router)
app.include_router(menu.router)
app.include_router(events.router)
app.include_router(orders.router)
app.include_router(admin_orders.router)
app.include_router(reviews_module.router)
app.include_router(uploads.router)
app.include_router(warehouse.router)

# seed restaurants/tables if not present
seed_restaurants()
seed_menu_items()
seed_events()


@app.get("/")
def read_root():
    # Root should serve the SPA when build artifacts exist.
    if build_index.exists():
        return FileResponse(str(build_index))
    return {
        "message": "Welcome to Building Store API",
        "version": "1.0.0",
        "docs": "/docs",
        "openapi": "/openapi.json"
    }


@app.get("/health")
def health_check():
    """Проверка здоровья приложения"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    host = (os.getenv("HOST") or "0.0.0.0").strip() or "0.0.0.0"
    port_raw = (os.getenv("PORT") or os.getenv("BACKEND_PORT") or "8001").strip()
    try:
        port = int(port_raw)
    except Exception:
        port = 8001
    uvicorn.run("main:app", host=host, port=port, reload=True)


# Serve frontend build from backend to avoid dev-server tunnel MIME/host issues.
project_root = Path(__file__).resolve().parent.parent
build_dir = project_root / "build"
build_static = build_dir / "static"
build_index = build_dir / "index.html"
build_photo_dir = build_dir / "photo"
public_photo_dir = project_root / "public" / "photo"
# Use build/photo if available (Render), fall back to public/photo (dev)
photo_dir = build_photo_dir if build_photo_dir.exists() else public_photo_dir

if build_static.exists():
    app.mount("/static", StaticFiles(directory=str(build_static)), name="frontend-static")
if photo_dir.exists():
    app.mount("/photo", StaticFiles(directory=str(photo_dir)), name="photo-static")


@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    if full_path.startswith("api/") or full_path in {"api", "docs", "openapi.json", "health"}:
        raise HTTPException(status_code=404, detail="Not found")
    if build_index.exists():
        return FileResponse(str(build_index))
    return {
        "message": "Frontend build not found. Run `npm run build` in project root.",
        "requested_path": full_path,
    }
