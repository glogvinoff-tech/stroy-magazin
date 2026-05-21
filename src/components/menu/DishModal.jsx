import React from 'react';
import { Icons } from '../icons/Icons';
import { useI18n } from '../../hooks/useI18n';

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
  const catLabel = CAT_KEY[dish?.cat] ? t(CAT_KEY[dish.cat]) : dish?.cat;
  const basePrice = Number((dish && (dish.base_price ?? dish.price)) || 0);
  const disc = clampPercent(dish?.discount_percent || 0);
  const fp = finalPrice(basePrice, disc);
  return (
    <div className="modal-ov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="dish-hero">
          <img className="dish-img" src={dish.img} alt={dish.name}/>
          <button type="button" className="m-x dish-close" onClick={onClose} aria-label={t('close')}>
            <Icons.Close />
          </button>
          {dish.badge && <div className="mc-badge dish-badge">{dish.badge}</div>}
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
