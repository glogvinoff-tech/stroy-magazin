from pathlib import Path
import re
import secrets

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from database import get_db
from models import Role, User

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PHOTO_DIR = PROJECT_ROOT / "public" / "photo"
PHOTO_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024


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


def _slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "_", str(value or "").strip())
    cleaned = cleaned.strip("._-")
    return cleaned[:48] or "image"


@router.post("/image", response_model=dict)
async def upload_image(
    admin_id: int = Form(...),
    file: UploadFile = File(...),
    prefix: str = Form("admin"),
    db: Session = Depends(get_db),
):
    _require_admin(db, admin_id)
    ext = Path(file.filename or "image").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image format")
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if len(payload) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is too large")
    filename = f"{_slugify(prefix)}_{secrets.token_hex(6)}{ext}"
    target = PHOTO_DIR / filename
    target.write_bytes(payload)
    return {"ok": True, "filename": filename, "url": f"/photo/{filename}"}
