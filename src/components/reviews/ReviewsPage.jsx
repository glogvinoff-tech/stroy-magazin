import React, { useEffect, useRef, useState } from 'react';
import { Icons } from '../icons/Icons';
import { useI18n } from '../../hooks/useI18n';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../utils/api';
import { makeStorageKey, readJsonStorageWithLegacy } from '../../utils/brand';

const REVIEW_PHOTOS_KEY = 'review_local_photos';
const REVIEW_PARTNERS_SUFFIX = 'review_partners';
const REVIEW_PARTNERS_KEY = makeStorageKey(REVIEW_PARTNERS_SUFFIX);
const DEFAULT_REVIEW_PARTNERS = [
  { title: 'Частные мастера', text: 'Материалы и расходники для ежедневных объектов.' },
  { title: 'Строительные бригады', text: 'Повторяемые заказы, комплектация и доставка на адрес.' },
  { title: 'Дизайнеры и прорабы', text: 'Подбор отделки, крепежа и инженерных позиций под проект.' },
  { title: 'Домовладельцы', text: 'Ремонт, дача, мастерская и бытовые задачи без лишней сложности.' },
];

function loadReviewPartners() {
  const parsed = readJsonStorageWithLegacy(REVIEW_PARTNERS_SUFFIX, DEFAULT_REVIEW_PARTNERS, Array.isArray);
  return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_REVIEW_PARTNERS;
}

function getLocalPhoto(reviewId) {
  try {
    const raw = localStorage.getItem(REVIEW_PHOTOS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map[String(reviewId)] || null;
  } catch { return null; }
}

function saveLocalPhoto(reviewId, dataUrl) {
  try {
    const raw = localStorage.getItem(REVIEW_PHOTOS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[String(reviewId)] = dataUrl;
    localStorage.setItem(REVIEW_PHOTOS_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

function Stars({ rating, onSet }) {
  return (
    <div style={{ display: 'flex', gap: 4, cursor: onSet ? 'pointer' : 'default' }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          onClick={() => onSet && onSet(s)}
          style={{
            fontSize: onSet ? 28 : 16,
            color: s <= rating ? 'var(--gold)' : 'rgba(255,255,255,0.2)',
            transition: 'color .18s',
            userSelect: 'none',
          }}
        >
          {s <= rating ? '★' : '☆'}
        </span>
      ))}
    </div>
  );
}

function ReviewCard({ review, t }) {
  const localPhoto = getLocalPhoto(review.id);
  const photo = review.photo_url || localPhoto;
  return (
    <div className="review-card rv-full">
      {photo && (
        <div style={{ marginBottom: 12, borderRadius: 10, overflow: 'hidden', maxHeight: 220 }}>
          <img
            src={photo}
            alt="Фото к отзыву"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
          />
        </div>
      )}
      <div className="review-top">
        <div>
          <div className="review-name">{review.author_name}</div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
            {review.created_at ? new Date(review.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
          </div>
        </div>
        <Stars rating={review.rating} />
      </div>
      <div className="review-text" style={{ marginTop: 10 }}>{review.text}</div>
      {review.admin_reply && (
        <div className="rv-reply">
          <div className="rv-reply-label">
            <Icons.Message /> {t('review_admin_reply_label')}
          </div>
          <div className="rv-reply-text">{review.admin_reply}</div>
        </div>
      )}
    </div>
  );
}

export function ReviewsPage({ toast }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [partners, setPartners] = useState(loadReviewPartners);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [author, setAuthor] = useState(user?.name || user?.username || '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoDragging, setPhotoDragging] = useState(false);
  const photoInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.reviews.list(false);
        if (!cancelled) setReviews(Array.isArray(data) ? data : []);
      } catch { /* fallback to empty */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [submitted]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === REVIEW_PARTNERS_KEY) setPartners(loadReviewPartners());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handlePhotoChange = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const created = await api.reviews.create(
        { author_name: author.trim() || t('guest'), rating, text: text.trim() },
        user?.id || null
      );
      // Save photo locally keyed by returned review ID
      if (photoPreview && created?.id) {
        saveLocalPhoto(created.id, photoPreview);
      }
      setSubmitted(s => !s); // trigger reload
      setShowForm(false);
      setText('');
      setRating(5);
      setPhotoPreview(null);
      toast?.ok(t('review_submitted'));
    } catch (e) {
      toast?.err(e.message || t('admin_reviews_err'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page rv-page">
      <div className="page-title">{t('reviews_title_pre')} <em>{t('reviews_title_em')}</em></div>
      <div className="page-sub">{t('reviews_sub')}</div>

      <div className="rv-partners">
        <div className="rv-partners-title">С кем мы работаем</div>
        <div className="rv-partners-grid">
          {partners.map((item, idx) => (
            <div key={`${item.title}-${idx}`} className="rv-partner-card">
              <div>{item.title}</div>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rv-actions">
        {!showForm && (
          <button type="button" className="btn btn-gold" onClick={() => setShowForm(true)}>
            <Icons.Star /> {t('reviews_write_btn')}
          </button>
        )}
      </div>

      {showForm && (
        <div className="rv-form-card">
          <div className="rv-form-title">{t('review_form_title')}</div>
          <div className="fg" style={{ marginBottom: 14 }}>
            <div className="fl">{t('review_rating')}</div>
            <Stars rating={rating} onSet={setRating} />
          </div>
          {!user && (
            <div className="fg" style={{ marginBottom: 14 }}>
              <div className="fl">{t('review_author')}</div>
              <input className="fi" type="text" value={author} onChange={e => setAuthor(e.target.value)} placeholder={t('review_author_ph')} />
            </div>
          )}
          <div className="fg" style={{ marginBottom: 14 }}>
            <div className="fl">{t('review_text')}</div>
            <textarea className="fi" rows={4} value={text} onChange={e => setText(e.target.value)} placeholder={t('review_text_ph')} style={{ resize: 'none', lineHeight: 1.6 }} />
          </div>

          {/* Photo upload */}
          <div className="fg" style={{ marginBottom: 16 }}>
            <div className="fl">📷 Фото к отзыву <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(необязательно)</span></div>
            {photoPreview ? (
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', maxHeight: 200 }}>
                <img src={photoPreview} alt="preview" style={{ width: '100%', objectFit: 'cover', display: 'block', maxHeight: 200 }} />
                <button
                  type="button"
                  onClick={() => { setPhotoPreview(null); }}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.65)', border: 'none',
                    color: '#fff', fontSize: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >✕</button>
              </div>
            ) : (
              <div
                className={`rv-photo-drop${photoDragging ? ' drag' : ''}`}
                onDragOver={e => { e.preventDefault(); setPhotoDragging(true); }}
                onDragLeave={() => setPhotoDragging(false)}
                onDrop={e => { e.preventDefault(); setPhotoDragging(false); const f = e.dataTransfer.files[0]; if (f) handlePhotoChange(f); }}
                onClick={() => photoInputRef.current?.click()}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Перетащите фото или нажмите для выбора</div>
                <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>JPG, PNG, WEBP · до 10 МБ</div>
              </div>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoChange(f); e.target.value = ''; }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setPhotoPreview(null); }}>{t('close')}</button>
            <button type="button" className="btn btn-gold" onClick={handleSubmit} disabled={submitting || !text.trim()}>
              {submitting ? t('review_submitting') : t('review_submit')}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)' }}>{t('loading')}</div>
      ) : reviews.length === 0 ? (
        <div className="rv-empty">
          <div style={{ fontSize: 38, marginBottom: 10 }}>💬</div>
          <div style={{ fontFamily: 'var(--ff-d)', fontSize: 22, color: 'var(--text)', marginBottom: 6 }}>{t('reviews_empty')}</div>
          <button type="button" className="btn btn-gold" onClick={() => setShowForm(true)}>
            <Icons.Star /> {t('reviews_write_btn')}
          </button>
        </div>
      ) : (
        <div className="rv-grid">
          {reviews.map(r => <ReviewCard key={r.id} review={r} t={t} />)}
        </div>
      )}

      <style>{`
        .rv-page { max-width: 900px; margin: 0 auto; padding: 60px 32px; }
        .rv-actions { margin: 20px 0; }
        .rv-partners{margin:22px 0;border:1px solid var(--glass-border);border-radius:var(--r-lg);background:var(--glass);padding:18px;}
        .rv-partners-title{font-family:var(--ff-d);font-size:26px;color:var(--text);margin-bottom:12px;}
        .rv-partners-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
        .rv-partner-card{border:1px solid var(--glass-border);border-radius:var(--r-md);background:rgba(255,255,255,.03);padding:12px;color:var(--text);font-size:13px;}
        .rv-partner-card p{margin-top:6px;color:var(--muted-strong);font-size:12px;line-height:1.55;}
        .rv-form-card {
          border: 1px solid var(--glass-border);
          border-radius: var(--r-lg);
          background: var(--glass);
          padding: 22px;
          margin-bottom: 28px;
          animation: modalIn .35s var(--ease);
        }
        .rv-form-title { font-family: var(--ff-d); font-size: 22px; color: var(--text); margin-bottom: 18px; }
        .rv-photo-drop {
          border: 1.5px dashed var(--glass-border);
          border-radius: var(--r-md);
          padding: 28px 20px;
          text-align: center;
          cursor: pointer;
          transition: border-color .22s, background .22s;
          background: rgba(255,255,255,0.02);
        }
        .rv-photo-drop:hover, .rv-photo-drop.drag {
          border-color: rgba(201,169,110,0.5);
          background: rgba(201,169,110,0.04);
        }
        .rv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-top: 14px; }
        .rv-full { padding: 18px; }
        .rv-reply {
          margin-top: 14px; padding: 12px; border-radius: var(--r-md);
          background: rgba(201,169,110,0.06); border: 1px solid rgba(201,169,110,0.20);
        }
        .rv-reply-label { display:flex; align-items:center; gap:8px; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:var(--gold); margin-bottom:6px; }
        .rv-reply-text { font-size:13px; color:var(--muted-strong); line-height:1.6; }
        .rv-empty { text-align:center; padding:60px 0; }
        @media(max-width:860px) { .rv-partners-grid{grid-template-columns:1fr 1fr;} }
        @media(max-width:640px) { .rv-page { padding:36px 16px; } .rv-partners-grid{grid-template-columns:1fr;} }
      `}</style>
    </div>
  );
}
