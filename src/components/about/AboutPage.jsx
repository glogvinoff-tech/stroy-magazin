import React, { useEffect, useState } from 'react';
import { Icons } from '../icons/Icons';
import { CONTACT_INFO } from '../../utils/contactInfo';
import { useI18n } from '../../hooks/useI18n';
import { api } from '../../utils/api';

const FALLBACK_REVIEWS = [
  { id: 'f1', author_name: 'Алина', rating: 5, text: 'Быстро собрали заказ, помогли подобрать крепёж и доставили в срок.' },
  { id: 'f2', author_name: 'Дмитрий', rating: 5, text: 'Хороший выбор инструмента и материалов. Консультация по делу, без лишнего.' },
  { id: 'f3', author_name: 'Мария', rating: 4, text: 'Удобный каталог, нашла плитку и грунтовку для ремонта в одном месте.' },
];

function Stars({ rating }) {
  const { t } = useI18n();
  const r = Math.max(0, Math.min(5, Number(rating || 0)));
  const full = '★★★★★'.slice(0, r);
  const empty = '☆☆☆☆☆'.slice(0, 5 - r);
  return <span className="rv-stars" aria-label={t('rating_aria', { rating: r })}>{full}{empty}</span>;
}

export function AboutPage({ setPage, setModal }) {
  const { t } = useI18n();
  const [reviews, setReviews] = useState(FALLBACK_REVIEWS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.reviews.list(true); // featured only
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setReviews(data.slice(0, 3));
        }
      } catch {
        // keep fallbacks
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="page about-page">
      <div className="page-title">{t('about_title_pre')} <em>{t('about_title_em')}</em></div>
      <div className="page-sub">{t('about_sub')}</div>

      <div className="about-grid">
        <div className="about-card">
          <div className="about-card-h"><Icons.Info /> {t('about_concept_h')}</div>
          <div className="about-card-p">
            {t('about_concept_p')}
          </div>
          <ul className="about-list">
            <li>{t('about_concept_li1')}</li>
            <li>{t('about_concept_li2')}</li>
            <li>{t('about_concept_li3')}</li>
          </ul>
        </div>

        <div className="about-card">
          <div className="about-card-h"><Icons.User /> {t('about_chef_h')}</div>
          <div className="chef">
            <img
              className="chef-img"
              src="https://masterpiecer-images.s3.yandex.net/f80ef06d80dd11eeb2aa1e5d9776cfa6:upscaled"
              alt={t('about_chef_alt')}
              loading="lazy"
            />
            <div className="chef-body">
              <div className="chef-name">{t('about_chef_name')}</div>
              <div className="chef-sub">{t('about_chef_sub')}</div>
              <div className="chef-txt">
                {t('about_chef_quote')}
              </div>
            </div>
          </div>
        </div>

        <div className="about-card about-wide">
          <div className="about-card-h"><Icons.Sparkles /> {t('about_story_h')}</div>
          <div className="about-card-p">
            {t('about_story_p')}
          </div>
          <div className="about-cta">
            <button type="button" className="btn btn-gold" onClick={() => setPage?.('menu')}>
              <Icons.Cart /> {t('В каталог')}
            </button>
          </div>
        </div>
      </div>

      <div className="about-strip">
        <div className="about-strip-main">
          <div className="about-strip-title">{t('about_where')}</div>
          <div className="about-strip-sub">{CONTACT_INFO.address} · {t('contacts_work_hours')}</div>
        </div>
        <button type="button" className="btn btn-outline-gold" onClick={() => setPage?.('contacts')}>
          <Icons.Map /> {t('nav_contacts')}
        </button>
      </div>

      <div className="about-reviews">
        <div className="about-reviews-header">
          <div className="about-reviews-h">{t('about_reviews_h')}</div>
          <button type="button" className="btn btn-ghost" onClick={() => setPage?.('reviews')}>
            <Icons.Star /> {t('reviews_write_btn')}
          </button>
        </div>
        <div className="reviews-grid">
          {reviews.map((r) => (
            <div key={r.id} className="review-card">
              <div className="review-top">
                <div className="review-name">{r.author_name}</div>
                <Stars rating={r.rating} />
              </div>
              <div className="review-text">{r.text}</div>
              {r.admin_reply && (
                <div style={{
                  marginTop: 10, padding: '8px 10px',
                  borderRadius: 10,
                  background: 'rgba(201,169,110,0.06)',
                  border: '1px solid rgba(201,169,110,0.18)',
                  fontSize: 12,
                  color: 'var(--muted-strong)',
                  lineHeight: 1.5,
                }}>
                  <span style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 11, letterSpacing: 1 }}>{t('review_admin_reply_label')}: </span>
                  {r.admin_reply}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button type="button" className="btn btn-outline-gold" onClick={() => setPage?.('reviews')}>
            {t('nav_reviews')} →
          </button>
        </div>
      </div>

      <style>{`
        .about-page{max-width:1200px;margin:0 auto;padding:60px 32px;}
        .about-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:28px;}
         .about-card{
          border:1px solid var(--glass-border);
          border-radius:var(--r-lg);
          background:var(--glass);
          padding:18px;
          overflow:hidden;
          position:relative;
        }
        .about-card::before{
          content:'';
          position:absolute;inset:-2px;
          background:
            radial-gradient(700px 180px at 10% 0%, rgba(201,169,110,0.14), transparent 60%),
            radial-gradient(700px 180px at 90% 20%, rgba(232,202,144,0.08), transparent 55%);
          pointer-events:none;
        }
        .about-card > *{position:relative;z-index:1;}
        .about-wide{grid-column:span 2;}
        .about-card-h{
          display:flex;align-items:center;gap:10px;
          font-family:var(--ff-d);
          font-size:22px;
          color:var(--text);
          margin-bottom:10px;
        }
        .about-card-h svg{color:var(--gold);}
        .about-card-p{color:var(--muted-strong);font-size:14px;line-height:1.7;}
        .about-list{margin-top:12px;padding-left:18px;color:var(--muted-strong);font-size:13px;line-height:1.7;}
        .about-list li{margin:6px 0;}

        .chef{display:flex;gap:14px;align-items:flex-start;}
        .chef-img{width:92px;height:92px;border-radius:16px;object-fit:cover;border:1px solid var(--glass-border);}
        .chef-name{font-family:var(--ff-d);font-size:18px;color:var(--text);}
        .chef-sub{margin-top:2px;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase;}
        .chef-txt{margin-top:10px;color:var(--muted-strong);font-size:13px;line-height:1.7;}

        .about-cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;}

        .about-strip{
          margin-top:16px;
          border:1px solid var(--glass-border);
          border-radius:var(--r-lg);
          background:var(--glass);
          padding:16px 18px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
        }
        .about-strip-title{font-family:var(--ff-d);font-size:20px;color:var(--text);}
        .about-strip-sub{margin-top:4px;color:var(--muted-strong);font-size:13px;line-height:1.6;}

        .about-reviews{margin-top:26px;}
        .about-reviews-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap;}
        .about-reviews-h{font-family:var(--ff-d);font-size:28px;color:var(--text);}
        .reviews-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
        .review-card{
          border:1px solid var(--glass-border);
          border-radius:var(--r-lg);
          background:var(--glass);
          padding:16px;
          overflow:hidden;
        }
        .review-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}
        .review-name{font-family:var(--ff-d);font-size:18px;color:var(--text);}
        .rv-stars{color:var(--gold2);letter-spacing:1px;font-size:14px;white-space:nowrap;}
        .review-text{color:var(--muted-strong);font-size:13px;line-height:1.7;}

        @media(max-width:1280px){
          .about-page{padding:56px 28px;}
        }
        @media(max-width:980px){
          .about-page{padding:48px 20px;}
          .about-grid{grid-template-columns:1fr;}
          .about-wide{grid-column:auto;}
          .reviews-grid{grid-template-columns:1fr 1fr;}
        }
        @media(max-width:640px){
          .reviews-grid{grid-template-columns:1fr;}
          .about-strip{flex-direction:column;align-items:flex-start;}
        }
        @media(max-width:540px){
          .about-page{padding:36px 16px;}
          .chef{flex-direction:column;}
          .chef-img{width:100%;height:160px;}
          .about-cta{flex-direction:column;}
          .about-cta .btn{width:100%;justify-content:center;}
        }
      `}</style>
    </div>
  );
}
