import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SLIDES } from '../../utils/heroSlides';
import { Icons } from '../icons/Icons';
import { useInView } from '../../hooks/useInView';
import { useI18n } from '../../hooks/useI18n';
import { useAuth } from '../../hooks/useAuth';
import { makeStorageKey, readJsonStorageWithLegacy } from '../../utils/brand';
import { api } from '../../utils/api';

const HERO_CONFIG_SUFFIX = 'hero_config';
const HERO_CONFIG_KEY = makeStorageKey(HERO_CONFIG_SUFFIX);

function buildSlidesFromConfig(config, menuItems = []) {
  if (!Array.isArray(config) || config.length === 0) return SLIDES;
  return config.map((slot, idx) => {
    const base = SLIDES[idx] || SLIDES[0];
    const isCustom = slot.mode === 'custom';

    if (isCustom) {
      return {
        ...base,
        dishId: null,
        dishKey: null,
        dishNameOverride: slot.titleOverride || slot.customTitle || base.dishNameOverride || '',
        titleAKey: null,
        titleBKey: null,
        tagKey: null,
        tagOverride: slot.tag !== undefined && slot.tag !== '' ? slot.tag : (base.tagKey ? null : ''),
        tagKeyFallback: base.tagKey,
        descKey: null,
        descOverride: slot.desc || '',
        img: slot.customImg || base.img,
        price: base.price,
        weight: base.weight,
      };
    }

    const dish = menuItems.find(d => Number(d.id) === Number(slot.dishId));
    if (!dish) return { ...base, descOverride: slot.desc || '' };
    return {
      ...base,
      dishId: dish.id,
      dishKey: null,
      dishNameOverride: slot.titleOverride || dish.name,
      titleAKey: null,
      titleBKey: null,
      tagKey: null,
      tagOverride: slot.tag !== undefined && slot.tag !== '' ? slot.tag : (base.tagKey ? null : ''),
      tagKeyFallback: base.tagKey,
      descKey: null,
      descOverride: slot.desc || '',
      price: String(dish.price),
      weight: dish.weight || base.weight,
      img: dish.img || base.img,
    };
  });
}

function getActiveSlides(menuItems = []) {
  try {
    const config = readJsonStorageWithLegacy(HERO_CONFIG_SUFFIX, null, Array.isArray);
    if (!Array.isArray(config)) return SLIDES;
    return buildSlidesFromConfig(config, menuItems);
  } catch {
    return SLIDES;
  }
}

function FadeSlideImage({ src, alt, priority = false, freeze = false }) {
  const [baseSrc, setBaseSrc] = useState(src || null);
  const [nextSrc, setNextSrc] = useState(null);
  const [fading, setFading] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!src) return;
    if (!baseSrc) {
      setBaseSrc(src);
      setNextSrc(null);
      setFading(false);
      return;
    }
    if (freeze) return;
    if (src === baseSrc) return;

    let cancelled = false;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;

    img.onload = () => {
      if (cancelled) return;
      const done = () => {
        if (cancelled) return;
        setNextSrc(src);
        requestAnimationFrame(() => setFading(true));
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setBaseSrc(src);
          setNextSrc(null);
          setFading(false);
        }, 420);
      };
      if (typeof img.decode === 'function') {
        img.decode().then(done).catch(done);
      } else {
        done();
      }
    };

    img.onerror = () => {
      if (cancelled) return;
      clearTimeout(timeoutRef.current);
      setBaseSrc(src);
      setNextSrc(null);
      setFading(false);
    };

    return () => {
      cancelled = true;
      clearTimeout(timeoutRef.current);
    };
  }, [src, baseSrc, freeze]);

  if (!baseSrc) return <div className="slide-img slide-img-placeholder" aria-hidden="true" />;

  return (
    <div className={`slide-img${fading ? ' fading' : ''}`}>
      <img
        className="slide-img-base"
        src={baseSrc}
        alt={alt}
        draggable="false"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onError={(e) => { e.currentTarget.style.opacity = '0'; }}
      />
      {nextSrc && (
        <img
          className="slide-img-next"
          src={nextSrc}
          alt=""
          aria-hidden="true"
          draggable="false"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          onError={(e) => { e.currentTarget.style.opacity = '0'; }}
        />
      )}
    </div>
  );
}

export function HeroPage({ onAddToCart, toast, setPage, setModal, onOpenAdminEdit }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role_name === 'admin' || user?.is_admin;
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);
  const [timerProgress, setTimerProgress] = useState(0);
  const [menuItems, setMenuItems] = useState([]);
  const [slides, setSlides] = useState(() => getActiveSlides([]));
  const introRef = useRef(null);
  const cardsRef = useRef(null);
  const INTERVAL = 9000;
  const timerRadius = 11;
  const timerCirc = 2 * Math.PI * timerRadius;
  const preloadedRef = useRef(new Set());
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  // Reload slides when admin config changes
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === HERO_CONFIG_KEY) {
        setSlides(getActiveSlides(menuItems));
        preloadedRef.current = new Set();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [menuItems]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.menu.list();
        if (cancelled) return;
        const safeList = Array.isArray(list) ? list : [];
        setMenuItems(safeList);
        setSlides(getActiveSlides(safeList));
      } catch {
        if (!cancelled) setMenuItems([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const introIn = useInView(introRef);
  const cardsIn = useInView(cardsRef);
  const len = slides.length;
  const prev = (cur - 1 + len) % len;
  const next = (cur + 1) % len;

  // Auto-advance with frame-driven progress, so the circular timer is reliable.
  useEffect(() => {
    if (paused || len <= 1) return;
    let raf = 0;
    let start = 0;
    const tick = (ts) => {
      if (!start) start = ts;
      const linear = Math.min(1, (ts - start) / INTERVAL);
      const progress = linear < 0.5
        ? 2 * linear * linear
        : 1 - Math.pow(-2 * linear + 2, 2) / 2;
      setTimerProgress(progress);
      if (linear >= 1) {
        setCur(s => (s + 1) % len);
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };
    setTimerProgress(0);
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [cur, len, paused]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') {
        setTimerProgress(0);
        setCur(s => (s + 1) % len);
        setPaused(false);
      } else if (e.key === 'ArrowLeft') {
        setTimerProgress(0);
        setCur(s => (s - 1 + len) % len);
        setPaused(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [len]);

  // Preload adjacent slides
  useEffect(() => {
    const slNext = slides[next];
    const slPrev = slides[prev];
    [slNext, slPrev].forEach(sl => {
      if (!sl?.img) return;
      if (preloadedRef.current.has(sl.img)) return;
      preloadedRef.current.add(sl.img);
      const run = () => { const img = new Image(); img.decoding = 'async'; img.src = sl.img; };
      if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 600 });
      else window.setTimeout(run, 0);
    });
  }, [next, prev, slides]);

  const go = useCallback((i) => {
    setCur((i + len) % len);
    setTimerProgress(0);
  }, [len]);

  // Touch / swipe handlers
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - (touchStartY.current || 0));
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 40 || dy > Math.abs(dx)) return; // not a horizontal swipe
    setTimerProgress(0);
    if (dx < 0) setCur(s => (s + 1) % len);
    else setCur(s => (s - 1 + len) % len);
  };

  return (
    <main className="home">
      <section
        className="hero"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Timer / pause button */}
        <button
          type="button"
          className={`hero-timer${paused ? ' paused' : ''}`}
          aria-label={paused ? t('hero_resume') || 'Возобновить' : t('hero_pause') || 'Пауза'}
          onClick={() => setPaused(p => !p)}
          style={{ '--hero-int': `${INTERVAL}ms`, '--hero-timer-circ': timerCirc, cursor: 'pointer' }}
        >
          {paused ? (
            /* Pause icon — two vertical bars */
            <svg viewBox="0 0 26 26" style={{ width: 18, height: 18, transform: 'none' }}>
              <rect x="5" y="4" width="5" height="18" rx="2" fill="var(--gold)" />
              <rect x="16" y="4" width="5" height="18" rx="2" fill="var(--gold)" />
            </svg>
          ) : (
            <svg viewBox="0 0 32 32">
              <circle className="hero-timer-track" cx="16" cy="16" r={timerRadius} />
              <circle
                key={`timer-${cur}`}
                className="hero-timer-prog"
                cx="16"
                cy="16"
                r={timerRadius}
                strokeDasharray={timerCirc}
                strokeDashoffset={timerCirc * (1 - timerProgress)}
                style={{ '--hero-timer-circ': timerCirc }}
              />
            </svg>
          )}
        </button>

        <div className="slide-counter">
          <strong>{String(cur + 1).padStart(2, '0')}</strong> / {String(slides.length).padStart(2, '0')}
        </div>

        <div className="slides-wrap">
          {slides.map((sl, i) => {
            const dishName = sl.dishNameOverride || (sl.dishKey ? t(sl.dishKey) : '');
            const tagLabel = sl.tagOverride !== undefined
              ? sl.tagOverride
              : (sl.tagKeyFallback ? t(sl.tagKeyFallback) : (sl.tagKey ? t(sl.tagKey) : ''));
            const titleA = sl.titleAKey ? t(sl.titleAKey) : dishName.split(' ').slice(0, 2).join(' ');
            const titleB = sl.titleBKey ? t(sl.titleBKey) : dishName.split(' ').slice(2).join(' ');
            const desc = sl.descOverride !== undefined ? sl.descOverride : (sl.descKey ? t(sl.descKey) : '');
            return (
              <div key={i} className={`slide${i === cur ? ' cur' : ''}`}>
                <FadeSlideImage
                  src={(i === cur || i === prev || i === next) ? sl.img : null}
                  alt={dishName}
                  priority={i === cur}
                  freeze={i !== cur}
                />
                <div className="slide-fog slide-fog-dark" />
                <div className="slide-fog slide-fog-light" />
                <div className="slide-body">
                  <div className="slide-tag">{tagLabel}</div>
                  <h1 className="slide-h">
                    {titleA}{titleB ? <><br /><em>{titleB}</em></> : null}
                  </h1>
                  {desc && <p className="slide-p">{desc}</p>}
                  <div className="slide-cta">
                    <button type="button" className="btn btn-gold btn-hero" onClick={() => {
                      const d = menuItems.find(x => Number(x.id) === Number(sl.dishId));
                      if (d) { onAddToCart(d); toast.ok(t('toast_added_to_cart', { name: dishName })); }
                    }}>
                      <Icons.Plus /> {t('hero_order_now')}
                    </button>
                    <button type="button" className="btn btn-hero-ghost" onClick={() => setPage('menu')}>
                      {t('hero_view_menu')}
                    </button>
                  </div>
                </div>
                <div className="price-card">
                  {isAdmin && (
                    <button
                      type="button"
                      className="pc-admin-edit"
                      title={t('admin_hero_tab')}
                      onClick={() => setModal && setModal('admin')}
                    >
                      <Icons.Image />
                    </button>
                  )}
                  <div className="pc-label">{t('hero_dish_of_day')}</div>
                  <div className="pc-name">{dishName}</div>
                  <div className="pc-price"><sup>₽</sup>{sl.price}</div>
                  <div className="pc-desc">{sl.weight}</div>
                  <button type="button" className="pc-btn" onClick={() => {
                    const d = menuItems.find(x => Number(x.id) === Number(sl.dishId));
                    if (d) { onAddToCart(d); toast.ok(t('toast_added_to_cart', { name: dishName })); }
                  }}>
                    + {t('to_cart')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="slider-ctrl">
          <div className="dots-row">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`dot-el${i === cur ? ' on' : ''}`}
                onClick={() => { go(i); setPaused(false); }}
                aria-label={t('hero_slide_aria', { index: i + 1 })}
              />
            ))}
          </div>
          <div className="arr-row">
            <button
              type="button"
              className="arr-btn"
              onClick={() => { go(cur - 1); setPaused(false); }}
              aria-label={t('hero_prev_slide')}
            >
              <Icons.ChL />
            </button>
            <button
              type="button"
              className="arr-btn"
              onClick={() => { go(cur + 1); setPaused(false); }}
              aria-label={t('hero_next_slide')}
            >
              <Icons.ChR />
            </button>
          </div>
        </div>
      </section>

      <section ref={introRef} className={`home-band home-reveal${introIn ? ' on' : ''}`}>
        <div className="home-band-inner">
          <div className="home-head reveal" style={{ '--d': '0ms' }}>
            <div className="home-kicker">{t('home_kicker')}</div>
            <h2 className="home-title">
              {t('home_title_pre')} <em>{t('home_title_em')}</em> {t('home_title_post')}
            </h2>
            <p className="home-lead">{t('home_lead')}</p>
          </div>
          <div className="home-actions reveal" style={{ '--d': '140ms' }}>
            <button type="button" className="btn btn-gold" onClick={() => setPage('menu')}>
              <Icons.Cart /> {t('home_reserve')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setPage('menu')}>
              <Icons.Menu /> {t('Перейти в каталог')}
            </button>
          </div>
        </div>
      </section>

      <section ref={cardsRef} className={`home-cards home-reveal${cardsIn ? ' on' : ''}`}>
        <div className="home-cards-inner">
          <div className="home-cards-title reveal" style={{ '--d': '0ms' }}>
            {t('home_cards_title')}
          </div>
          <div className="home-grid">
            <div className="home-card reveal" style={{ '--d': '80ms' }}>
              <div className="home-card-ico"><Icons.Cal /></div>
              <div className="home-card-h">{t('home_card_reserve_h')}</div>
              <div className="home-card-p">{t('home_card_reserve_p')}</div>
            </div>
            <div className="home-card reveal" style={{ '--d': '140ms' }}>
              <div className="home-card-ico"><Icons.Menu /></div>
              <div className="home-card-h">{t('home_card_menu_h')}</div>
              <div className="home-card-p">{t('home_card_menu_p')}</div>
            </div>
            <div className="home-card reveal" style={{ '--d': '200ms' }}>
              <div className="home-card-ico"><Icons.Diamond /></div>
              <div className="home-card-h">{t('home_card_pro_h')}</div>
              <div className="home-card-p">{t('home_card_pro_p')}</div>
            </div>
            <div className="home-card reveal" style={{ '--d': '260ms' }}>
              <div className="home-card-ico"><Icons.Message /></div>
              <div className="home-card-h">{t('home_card_support_h')}</div>
              <div className="home-card-p">{t('home_card_support_p')}</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
