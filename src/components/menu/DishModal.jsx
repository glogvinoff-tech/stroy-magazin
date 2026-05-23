import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '../icons/Icons';
import { useI18n } from '../../hooks/useI18n';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../utils/api';

const CAT_KEY = {
  Супы: 'cat_soups',
  Салаты: 'cat_salads',
  Закуски: 'cat_snacks',
  Горячее: 'cat_hot',
  Десерты: 'cat_desserts',
  Напитки: 'cat_drinks',
};

const clampPercent = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(90, Math.round(n)));
};

const finalPrice = (basePrice, discountPercent) => {
  const base = Number(basePrice || 0);
  const disc = clampPercent(discountPercent);
  if (!disc) return base;
  return Math.max(0, Math.round(base * (100 - disc) / 100));
};

export function DishModal({ dish, onClose, onAdd, toast }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const catLabel = CAT_KEY[dish?.cat] ? t(CAT_KEY[dish.cat]) : dish?.cat;
  const basePrice = Number((dish && (dish.base_price ?? dish.price)) || 0);
  const disc = clampPercent(dish?.discount_percent || 0);
  const fp = finalPrice(basePrice, disc);
  const ratingAvg = useMemo(() => {
    if (!reviews.length) return 0;
    return reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length;
  }, [reviews]);
  const gallery = useMemo(() => {
    const urls = [dish?.img, ...(Array.isArray(dish?.gallery) ? dish.gallery : [])]
      .map((x) => String(x || '').trim())
      .filter(Boolean);
    const uniq = Array.from(new Set(urls));
    return uniq.map((src, idx) => ({ src, label: `Фото ${idx + 1}`, cls: '' }));
  }, [dish?.gallery, dish?.img]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.reviews.list(false, dish?.id);
        if (!cancelled) setReviews(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setReviews([]);
      }
    })();
    return () => { cancelled = true; };
  }, [dish?.id]);

  const submitReview = async () => {
    const text = reviewText.trim();
    if (!text) return;
    setReviewSaving(true);
    try {
      await api.reviews.create({
        item_id: dish.id,
        author_name: user?.name || user?.username || t('guest'),
        rating: reviewRating,
        text,
      }, user?.id || null);
      const data = await api.reviews.list(false, dish.id);
      setReviews(Array.isArray(data) ? data : []);
      setReviewText('');
      setReviewRating(5);
      toast?.ok?.(t('review_submitted'));
    } catch (e) {
      toast?.err?.(e.message || t('admin_reviews_err'));
    } finally {
      setReviewSaving(false);
    }
  };

  return (
    <div className="modal-ov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="dish-hero">
          <img className={`dish-img ${gallery[galleryIndex]?.cls || ''}`} src={gallery[galleryIndex]?.src || dish.img} alt={dish.name}/>
          <button type="button" className="m-x dish-close" onClick={onClose} aria-label={t('close')}>
            <Icons.Close />
          </button>
          {dish.badge && <div className="mc-badge dish-badge">{dish.badge}</div>}
          {gallery.length > 1 && (
            <div className="dish-gallery">
              {gallery.map((item, idx) => (
                <button
                  key={item.label}
                  type="button"
                  className={`dish-gallery-thumb${idx === galleryIndex ? ' on' : ''}`}
                  onClick={() => setGalleryIndex(idx)}
                  aria-label={item.label}
                >
                  <img className={item.cls} src={item.src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="dish-body">
          <div className="mc-tags dish-tags">
            {dish.tags.map(t => <span key={t} className={`tag-chip ${t}`}>{t}</span>)}
          </div>
          <div className="dish-name">{dish.name}</div>
          <div className="dish-meta">
            <div className="dm-item">
              <div className="dm-label"><Icons.Kettlebell /> {t('dish_weight')}</div>
              <div className="dm-val">{dish.weight}</div>
            </div>
            <div className="dm-item">
              <div className="dm-label">{t('dish_category')}</div>
              <div className="dm-val">{catLabel}</div>
            </div>
          </div>
          <div className="dish-desc">{dish.desc}</div>
          <div className="dish-ingr"><strong>{t('dish_composition')}: </strong>{dish.ingr}</div>
          <div className="dish-reputation">
            <div className="dish-rep-head">
              <span>Репутация товара</span>
              <strong>{reviews.length ? `${ratingAvg.toFixed(1)} / 5` : 'Нет оценок'}</strong>
            </div>
            <div className="dish-stars" aria-label={`rating ${ratingAvg.toFixed(1)}`}>
              {[1, 2, 3, 4, 5].map((s) => <span key={s}>{s <= Math.round(ratingAvg) ? '★' : '☆'}</span>)}
              <em>{reviews.length} отзывов</em>
            </div>
            <div className="dish-review-form">
              <div className="dish-review-stars">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button" className={s <= reviewRating ? 'on' : ''} onClick={() => setReviewRating(s)}>
                    ★
                  </button>
                ))}
              </div>
              <textarea className="fi" rows={2} value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Ваш отзыв о товаре" />
              <button type="button" className="btn btn-outline-gold" onClick={submitReview} disabled={reviewSaving || !reviewText.trim()}>
                {reviewSaving ? 'Сохраняю...' : 'Оставить отзыв'}
              </button>
            </div>
            {reviews.slice(0, 3).map((r) => (
              <div key={r.id} className="dish-review">
                <div><strong>{r.author_name}</strong><span>{' '}· {r.rating}/5</span></div>
                <p>{r.text}</p>
              </div>
            ))}
          </div>
          <div className="dish-actions">
            <div className={disc > 0 ? 'dish-price-wrap' : undefined}>
              <div className="dish-price">{disc > 0 ? fp : basePrice}<sup> ₽</sup></div>
              {disc > 0 && (
                <div className="dish-price-sub">
                  <span className="dish-price-was">{basePrice} ₽</span>
                  <span className="dish-price-disc">-{disc}%</span>
                </div>
              )}
            </div>
            <button type="button" className="btn btn-gold btn-hero" onClick={() => { 
              onAdd(dish); 
              toast.ok(t('toast_in_cart', { name: dish.name })); 
              onClose(); 
            }}>
              <Icons.Plus /> {t('to_cart')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
