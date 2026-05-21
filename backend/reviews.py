from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import Review, User

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


class ReviewCreate(BaseModel):
    author_name: str = "Гость"
    rating: int = 5
    text: str
    order_id: str | None = None


class ReviewReply(BaseModel):
    admin_reply: str


class ReviewFeature(BaseModel):
    is_featured: bool


def _is_admin(db: Session, user_id: int) -> bool:
    try:
        u = db.query(User).filter(User.id == user_id).first()
        return bool(u and getattr(u.role, "name", None) == "admin")
    except Exception:
        return False


def _payload(r: Review) -> dict:
    return {
        "id": r.id,
        "user_id": r.user_id,
        "author_name": r.author_name or "Гость",
        "rating": r.rating,
        "text": r.text,
        "admin_reply": r.admin_reply,
        "is_featured": bool(r.is_featured),
        "order_id": r.order_id,
        "created_at": r.created_at,
    }


@router.get("/")
def list_reviews(featured_only: bool = False, db: Session = Depends(get_db)):
    q = db.query(Review)
    if featured_only:
        q = q.filter(Review.is_featured == True)
    reviews = q.order_by(desc(Review.created_at)).all()
    return [_payload(r) for r in reviews]


@router.post("/")
def create_review(payload: ReviewCreate, user_id: int | None = None, db: Session = Depends(get_db)):
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="text is required")
    rating = max(1, min(5, int(payload.rating or 5)))

    author_name = (payload.author_name or "").strip()
    if not author_name:
        if user_id:
            u = db.query(User).filter(User.id == user_id).first()
            author_name = (u.name or u.username or "Гость") if u else "Гость"
        else:
            author_name = "Гость"

    r = Review(
        user_id=user_id,
        author_name=author_name,
        rating=rating,
        text=text,
        order_id=(payload.order_id or "").strip() or None,
        is_featured=False,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _payload(r)


@router.put("/{review_id}/reply")
def reply_to_review(review_id: int, payload: ReviewReply, admin_id: int, db: Session = Depends(get_db)):
    if not _is_admin(db, admin_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    r = db.query(Review).filter(Review.id == review_id).first()
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    r.admin_reply = (payload.admin_reply or "").strip() or None
    db.add(r)
    db.commit()
    db.refresh(r)
    return _payload(r)


@router.put("/{review_id}/feature")
def feature_review(review_id: int, payload: ReviewFeature, admin_id: int, db: Session = Depends(get_db)):
    if not _is_admin(db, admin_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    r = db.query(Review).filter(Review.id == review_id).first()
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    r.is_featured = bool(payload.is_featured)
    db.add(r)
    db.commit()
    db.refresh(r)
    return _payload(r)


@router.delete("/{review_id}")
def delete_review(review_id: int, admin_id: int, db: Session = Depends(get_db)):
    if not _is_admin(db, admin_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    r = db.query(Review).filter(Review.id == review_id).first()
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    db.delete(r)
    db.commit()
    return {"ok": True}
