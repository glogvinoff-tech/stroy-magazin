import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from '../icons/Icons';
import { useI18n } from '../../hooks/useI18n';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../utils/api';
import { readJsonStorageWithLegacy, writeJsonStorage } from '../../utils/brand';
import { YandexAddressModal } from '../maps/YandexAddressModal';

function Stars({ rating, onSet }) {
  return (
    <div style={{ display: 'flex', gap: 4, cursor: onSet ? 'pointer' : 'default' }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          onClick={() => onSet && onSet(s)}
          style={{ fontSize: 26, color: s <= rating ? 'var(--gold)' : 'var(--border2)', transition: 'color .2s' }}
        >
          {s <= rating ? '★' : '☆'}
        </span>
      ))}
    </div>
  );
}

function ReviewForm({ onSubmit, onSkip, t, user }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [author, setAuthor] = useState(user?.name || user?.username || '');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await api.reviews.create(
        { author_name: author.trim() || t('guest'), rating, text: text.trim() },
        user?.id || null
      );
      setDone(true);
    } catch {
      // silent — still show done
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 38, marginBottom: 8 }}>🙏</div>
        <div style={{ fontFamily: 'var(--ff-d)', fontSize: 20, color: 'var(--text)', marginBottom: 6 }}>
          {t('review_submitted')}
        </div>
        <button type="button" className="btn btn-gold" style={{ marginTop: 14 }} onClick={onSkip}>
          {t('close')}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontFamily: 'var(--ff-d)', fontSize: 22, color: 'var(--text)', marginBottom: 4 }}>
        {t('review_cart_invite')}
      </div>
      <div style={{ color: 'var(--muted-strong)', fontSize: 13, marginBottom: 18 }}>
        {t('review_cart_invite_sub')}
      </div>
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
        <textarea className="fi" rows={3} value={text} onChange={e => setText(e.target.value)} placeholder={t('review_text_ph')} style={{ resize: 'none', lineHeight: 1.5 }} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onSkip}>{t('review_cart_skip')}</button>
        <button type="button" className="btn btn-gold" onClick={handleSubmit} disabled={submitting || !text.trim()}>
          {submitting ? t('review_submitting') : t('review_submit')}
        </button>
      </div>
    </div>
  );
}

export function CartDrawer({ cart, onClose, onQty, onRemove, toast, reservation, onReservationExpired, clearCart }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const [step, setStep] = useState(1);
  const [fulfillment, setFulfillment] = useState('delivery');
  const [fulfillmentTime, setFulfillmentTime] = useState('');
  const [payment, setPayment] = useState('card');
  const [address, setAddress] = useState('');
  const [saveAddressDefault, setSaveAddressDefault] = useState(true);
  const [mapOpen, setMapOpen] = useState(false);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [sourceRestaurantId, setSourceRestaurantId] = useState('');
  const [comment, setComment] = useState('');
  const [showReview, setShowReview] = useState(false);
  const yandexApiKey = process.env.REACT_APP_YANDEX_MAPS_API_KEY || '';
  const userKey = String(user?.id || 'guest');
  const timeSlots = useMemo(() => {
    const slots = [];
    const now = new Date();
    const start = new Date(now);
    start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0);
    for (let i = 0; i < 7 * 24 * 2; i += 1) {
      const dt = new Date(start.getTime() + i * 30 * 60 * 1000);
      const h = dt.getHours();
      if (h < 9 || h > 21 || (h === 21 && dt.getMinutes() > 0)) continue;
      const tz = dt.getTimezoneOffset() * 60000;
      const value = new Date(dt.getTime() - tz).toISOString().slice(0, 16);
      const label = dt.toLocaleString('ru-RU', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      slots.push({ value, label });
    }
    return slots;
  }, []);

  const toReservationList = (v) => (Array.isArray(v) ? v : v ? [v] : []);

  useEffect(() => {
    // Restore saved address and pickup source restaurant.
    try {
      const byUser = readJsonStorageWithLegacy('delivery_address_by_user', {}, (v) => v && typeof v === 'object');
      const savedAddr = byUser && typeof byUser === 'object' ? String(byUser[userKey] || '') : '';
      if (savedAddr) setAddress(savedAddr);
    } catch { /* ignore */ }

    try {
      const byUser = readJsonStorageWithLegacy('order_source_restaurant_by_user', {}, (v) => v && typeof v === 'object');
      const savedId = byUser && typeof byUser === 'object' ? String(byUser[userKey] || '') : '';
      if (savedId) setSourceRestaurantId(savedId);
    } catch { /* ignore */ }
  }, [userKey]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setRestaurantsLoading(true);
      try {
        const list = await api.restaurants.list();
        if (!alive) return;
        setRestaurants(Array.isArray(list) ? list : []);
      } catch {
        if (!alive) return;
        setRestaurants([]);
      } finally {
        if (!alive) return;
        setRestaurantsLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, []);

  const isExpired = (r) => {
    if (!r || r.is_cancelled) return false;
    try {
      const resDate = new Date(`${r.date}T${r.time || '00:00'}`);
      return resDate < new Date();
    } catch {
      return false;
    }
  };

  const reservationList = useMemo(() => toReservationList(reservation), [reservation]);
  const expiredReservations = useMemo(() => reservationList.filter(isExpired), [reservationList]);
  const activeReservations = useMemo(() => reservationList.filter((r) => !isExpired(r)), [reservationList]);

  // Auto-remove expired reservation — fire only once per mount via ref
  const expiredFiredRef = useRef(false);
  useEffect(() => {
    if (expiredReservations.length > 0 && !expiredFiredRef.current && onReservationExpired) {
      expiredFiredRef.current = true;
      onReservationExpired(expiredReservations);
      toast?.ok(t('reservation_expired_removed'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiredReservations.length]);

  const reservationStatusFor = (r) => {
    if (!r) return null;
    if (r.is_cancelled) return { text: t('reservation_cancelled'), cls: 'bad' };
    if (r.is_confirmed) return { text: t('reservation_confirmed'), cls: 'ok' };
    return { text: t('reservation_pending'), cls: 'wait' };
  };

  const handleMapSelect = ({ address: a, saveDefault: saveDef }) => {
    const next = String(a || '').trim();
    if (next) setAddress(next);
    setMapOpen(false);
    if (next && saveDef) {
      try {
        const prev = readJsonStorageWithLegacy('delivery_address_by_user', {}, (v) => v && typeof v === 'object');
        const merged = { ...(prev && typeof prev === 'object' ? prev : {}), [userKey]: next };
        writeJsonStorage('delivery_address_by_user', merged);
        toast?.ok?.(t('cart_address_saved'));
      } catch { /* ignore */ }
    }
  };

  const checkout = async () => {
    if (!fulfillmentTime) {
      toast.err(t('cart_time_required'));
      return;
    }
    if (fulfillmentTime) {
      const selected = new Date(fulfillmentTime);
      if (Number.isFinite(selected.getTime()) && selected < new Date()) {
        toast.err(t('cart_time_past'));
        return;
      }
    }
    if (fulfillment === 'delivery' && !address.trim()) {
      toast.err(t('cart_address_required'));
      return;
    }
    if (fulfillment === 'pickup' && !String(sourceRestaurantId || '').trim()) {
      toast.err(t('cart_pickup_from_required'));
      return;
    }
    await new Promise(r => setTimeout(r, 800));
    const fLabel = fulfillment === 'pickup' ? t('fulfillment_pickup') : t('fulfillment_delivery');
    const pLabel = payment === 'cash' ? t('payment_cash') : payment === 'online' ? t('payment_online') : t('payment_card');
    const when = fulfillmentTime ? t('when_label', { time: fulfillmentTime }) : '';
    const cmt = comment.trim() ? t('comment_ack') : '';
    toast.ok(t('order_accepted', { fulfillment: fLabel, when, payment: pLabel, comment: cmt }));
    let backendOrder = null;
    try {
      backendOrder = await api.orders.create(user?.id || null, {
        items: cart.map(i => ({ id: i.id, qty: i.qty, price: i.price, name: i.name })),
        total,
        fulfillment,
        fulfillment_time: fulfillmentTime,
        payment,
        restaurant_id: String(sourceRestaurantId || '') ? Number(sourceRestaurantId) : null,
        address: fulfillment === 'delivery' ? address.trim() : '',
        comment: comment.trim(),
      });
    } catch {
      // Non-blocking: order is still accepted in UI and stored locally.
    }

    // Save order to history in localStorage
    try {
      const prev = readJsonStorageWithLegacy('order_history', [], Array.isArray);
      const order = {
        id: backendOrder?.id || Date.now(),
        date: backendOrder?.created_at || new Date().toISOString(),
        items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price, img: i.img })),
        total,
        fulfillment,
        fulfillmentTime: fulfillmentTime || '',
        payment,
        restaurantId: String(sourceRestaurantId || ''),
        address: address.trim(),
        comment: comment.trim(),
        status: backendOrder?.status || 'pending',
      };
      writeJsonStorage('order_history', [order, ...(Array.isArray(prev) ? prev : [])].slice(0, 50));
    } catch { /* ignore */ }

    // Save defaults
    try {
      if (String(sourceRestaurantId || '').trim()) {
        const prev = readJsonStorageWithLegacy('order_source_restaurant_by_user', {}, (v) => v && typeof v === 'object');
        const next = { ...(prev && typeof prev === 'object' ? prev : {}), [userKey]: String(sourceRestaurantId || '') };
        writeJsonStorage('order_source_restaurant_by_user', next);
      }
    } catch { /* ignore */ }
    try {
      if (fulfillment === 'delivery' && saveAddressDefault && address.trim()) {
        const prev = readJsonStorageWithLegacy('delivery_address_by_user', {}, (v) => v && typeof v === 'object');
        const next = { ...(prev && typeof prev === 'object' ? prev : {}), [userKey]: address.trim() };
        writeJsonStorage('delivery_address_by_user', next);
      }
    } catch { /* ignore */ }

    clearCart?.();
    setShowReview(true);
  };

  // Reset to step 1 when cart becomes empty or drawer reopens
  useEffect(() => {
    if (cart.length === 0) setStep(1);
  }, [cart.length]);

  return (
    <>
      <div className="drawer-ov" onClick={onClose}/>
      <div className="drawer">
        {/* Header */}
        <div className="d-hdr">
          {step === 2 && !showReview ? (
            <button
              type="button"
              className="d-close"
              onClick={() => setStep(1)}
              aria-label={t('back')}
              style={{ marginRight: 8 }}
            >
              <Icons.ArrowLeft />
            </button>
          ) : null}
          <div className="d-title" style={{ flex: 1 }}>
            {showReview
              ? t('title_cart')
              : step === 2
                ? t('cart_checkout_title') || 'Оформление'
                : t('title_cart')}
          </div>
          <button type="button" className="d-close" onClick={onClose} aria-label={t('close')}>
            <Icons.Close />
          </button>
        </div>

        {/* Step indicator (shown only when there are items and not in review) */}
        {cart.length > 0 && !showReview && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            padding: '0 20px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            {[1, 2].map((s) => (
              <React.Fragment key={s}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: step >= s ? 'var(--gold)' : 'rgba(255,255,255,0.08)',
                    border: step >= s ? 'none' : '1px solid rgba(255,255,255,0.14)',
                    color: step >= s ? '#1a1206' : 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                    transition: 'all 0.25s',
                  }}>{s}</div>
                  <span style={{
                    fontSize: 11,
                    color: step >= s ? 'var(--text)' : 'var(--muted)',
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    transition: 'color 0.25s',
                  }}>
                    {s === 1 ? (t('cart_step_items') || 'Корзина') : (t('cart_step_checkout') || 'Доставка')}
                  </span>
                </div>
                {s < 2 && (
                  <div style={{
                    flex: 1,
                    height: 1,
                    background: step > s ? 'var(--gold)' : 'rgba(255,255,255,0.10)',
                    margin: '0 10px',
                    transition: 'background 0.25s',
                  }} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Content area */}
        <div className="d-items">
          {showReview ? (
            <ReviewForm t={t} user={user} onSubmit={() => { setShowReview(false); onClose(); }} onSkip={() => { setShowReview(false); onClose(); }} />
          ) : step === 1 ? (
            /* ── STEP 1: Cart items ── */
            <>
              {activeReservations.length > 0 && (
                <div className="d-reservation">
                  <div className="d-reservation-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span>{t('cart_reserved')}</span>
                  </div>
                  {activeReservations.slice(0, 3).map((r) => {
                    const status = reservationStatusFor(r);
                    const ids = Array.isArray(r.table_ids) ? r.table_ids : (r.table_id ? [r.table_id] : []);
                    const shownIds = ids.slice(0, 3);
                    const moreTables = Math.max(0, ids.length - shownIds.length);
                    const tablesLabel = shownIds.length === 1
                      ? `, ${t('table_one', { id: shownIds[0] })}`
                      : shownIds.length > 1
                        ? `, ${t('table_many', { ids: shownIds.join(', ') })}${moreTables > 0 ? ` +${moreTables}` : ''}`
                        : '';
                    const rest = r.restaurant && r.restaurant.address
                      ? r.restaurant.address
                      : (r.restaurant_id ? `#${r.restaurant_id}` : '—');
                    return (
                      <div key={r.id} style={{ paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="d-reservation-line" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <span>{r.date} {r.time}</span>
                          {status && (
                            <span className={`admin-status ${status.cls}`} style={{ letterSpacing: 1.8, fontSize: 9, padding: '4px 8px' }}>
                              {status.text}
                            </span>
                          )}
                        </div>
                        <div className="d-reservation-meta">{t('guests_short', { count: r.guests })}</div>
                        <div className="d-reservation-meta">
                          {t('restaurant_label')}: {rest}{tablesLabel}
                        </div>
                      </div>
                    );
                  })}
                  {activeReservations.length > 3 && (
                    <div className="d-reservation-meta" style={{ marginTop: 8 }}>
                      +{activeReservations.length - 3}
                    </div>
                  )}
                </div>
              )}
              {cart.length === 0 ? (
                <div className="d-empty">
                  <div className="d-empty-icon">🛒</div>
                  <div className="d-empty-txt">{t('cart_empty_title')}</div>
                  <div className="d-empty-sub">{t('cart_empty_sub')}</div>
                </div>
              ) : cart.map(item => (
                <div className="cart-item" key={item.id}>
                  <div className="ci-img"><img src={item.img} alt={item.name}/></div>
                  <div className="ci-info">
                    <div className="ci-name">{item.name}</div>
                    <div className="ci-price">{item.price * item.qty} ₽</div>
                    <div className="ci-qty">
                      <button type="button" className="qty-btn" onClick={() => onQty(item.id, -1)} aria-label={t('qty_decrease')}><Icons.Minus /></button>
                      <input
                        className="qty-input"
                        type="number"
                        min="1"
                        max="999"
                        value={item.qty}
                        onChange={(e) => onQty(item.id, e.target.value, 'set')}
                        onBlur={(e) => {
                          if (!String(e.target.value || '').trim()) onQty(item.id, 1, 'set');
                        }}
                        aria-label={t('quantity') || t('qty_increase')}
                      />
                      <button type="button" className="qty-btn" onClick={() => onQty(item.id, +1)} aria-label={t('qty_increase')}><Icons.Plus /></button>
                    </div>
                  </div>
                  <button type="button" className="ci-del" onClick={() => {
                    onRemove(item.id);
                    toast.ok(t('toast_removed_from_cart'));
                  }}>
                    <Icons.Trash />
                  </button>
                </div>
              ))}
            </>
          ) : (
            /* ── STEP 2: Checkout form ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div className="fg" style={{ marginBottom: 14 }}>
                <div className="fl">{t('cart_fulfillment')}</div>
                <select className="fi" value={fulfillment} onChange={(e) => setFulfillment(e.target.value)}>
                  <option value="delivery">{t('cart_delivery')}</option>
                  <option value="pickup">{t('cart_pickup')}</option>
                </select>
              </div>

              <div className="fg" style={{ marginBottom: 14 }}>
                <div className="fl">{t('cart_pickup_from_ph')}</div>
                <select
                  className="fi"
                  value={sourceRestaurantId}
                  onChange={(e) => setSourceRestaurantId(e.target.value)}
                  disabled={restaurantsLoading}
                >
                  <option value="">{t('cart_pickup_from_ph')}</option>
                  {restaurants.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.name} — {r.address}
                    </option>
                  ))}
                </select>
              </div>

              <div className="fi-row" style={{ marginBottom: 14, flexDirection: 'row', gap: 8 }}>
                <div className="fg" style={{ marginBottom: 0 }}>
                  <div className="fl">{t('cart_time')}</div>
                  <select className="fi" value={fulfillmentTime} onChange={(e) => setFulfillmentTime(e.target.value)}>
                    <option value="">{t('cart_time_required')}</option>
                    {timeSlots.map((slot) => (
                      <option key={slot.value} value={slot.value}>{slot.label}</option>
                    ))}
                  </select>
                </div>
                <div className="fg" style={{ marginBottom: 0 }}>
                  <div className="fl">{t('cart_payment')}</div>
                  <select className="fi" value={payment} onChange={(e) => setPayment(e.target.value)}>
                    <option value="card">{t('cart_pay_card')}</option>
                    <option value="cash">{t('cart_pay_cash')}</option>
                    <option value="online">{t('cart_pay_online')}</option>
                  </select>
                </div>
              </div>

              {fulfillment === 'delivery' && (
                <div className="fg" style={{ marginBottom: 14 }}>
                  <div className="fl">{t('cart_address')}</div>
                  <input
                    className="fi"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t('cart_address_ph')}
                    style={{ marginBottom: 8 }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setMapOpen(true)}
                    title={!yandexApiKey ? t('map_no_key_short') : t('cart_choose_on_map')}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Icons.Map /> {t('cart_choose_on_map')}
                  </button>
                  {user && (
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, color: 'var(--muted-strong)', fontSize: 13 }}>
                      <input type="checkbox" checked={saveAddressDefault} onChange={(e) => setSaveAddressDefault(e.target.checked)} />
                      {t('cart_save_address')}
                    </label>
                  )}
                </div>
              )}

              <div className="fg" style={{ marginBottom: 0 }}>
                <div className="fl">{t('cart_comment')}</div>
                <textarea className="fi" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('cart_comment_ph')} style={{ resize: 'none', lineHeight: 1.5 }} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && !showReview && (
          <div className="d-foot">
            <div className="d-total">
              <span className="d-total-label">{t('total')}</span>
              <span className="d-total-price">{total} ₽</span>
            </div>
            {step === 1 ? (
              <button
                type="button"
                className="submit no-mt"
                onClick={() => setStep(2)}
              >
                {t('cart_continue') || 'Продолжить'} →
              </button>
            ) : (
              <button
                type="button"
                className="submit no-mt"
                onClick={checkout}
              >
                {t('checkout')}
              </button>
            )}
          </div>
        )}
      </div>
      <YandexAddressModal
        open={mapOpen}
        t={t}
        apiKey={yandexApiKey}
        initialAddress={address}
        onClose={() => setMapOpen(false)}
        onSelect={handleMapSelect}
      />
    </>
  );
}
