import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../hooks/useI18n';
import { useFavorites } from '../../hooks/useFavorites';
import { Icons } from '../icons/Icons';
import { ProModal } from './ProModal';
import { AdminModal } from '../admin/AdminModal';
import { readJsonStorageWithLegacy } from '../../utils/brand';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_EMOJI,
  ORDER_STATUS_CLS,
  ORDER_STATUS_FLOW,
  getAllOrderStatuses,
} from '../../utils/orderStatus';

export function ProfileModal({ onClose, toast, onRepeatOrder, onNavigate }) {
  const { user, login } = useAuth();
  const { t } = useI18n();
  const { favorites, toggle: toggleFav } = useFavorites();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [profile, setProfile] = useState(null);
  const userRef = useRef(user);
  const toastRef = useRef(toast);
  const [proOpen, setProOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderStatuses, setOrderStatuses] = useState({});
  const [historyTab, setHistoryTab] = useState('orders');
  const [form, setForm] = useState({
    name: '',
    full_name: '',
    phone: '',
    birth_date: '',
    email: '',
  });

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  // Load order statuses (and refresh on storage events)
  const loadStatuses = () => setOrderStatuses(getAllOrderStatuses());
  useEffect(() => {
    loadStatuses();
    window.addEventListener('storage', loadStatuses);
    return () => window.removeEventListener('storage', loadStatuses);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const p = await api.auth.getProfile(user.id);
        if (cancelled) return;
        setProfile(p);
        setForm({
          name: p.name || '',
          full_name: p.full_name || '',
          phone: p.phone || '',
          birth_date: p.birth_date || '',
          email: p.email || '',
        });
        const baseUser = userRef.current || {};
        login({
          ...baseUser,
          name: p.name || baseUser.name,
          full_name: p.full_name || baseUser.full_name,
          phone: p.phone || baseUser.phone,
          birth_date: p.birth_date || baseUser.birth_date,
          email: p.email || baseUser.email,
          avatar_url: p.vk_avatar_url || baseUser.avatar_url,
          is_pro: Boolean(p.is_pro ?? baseUser.is_pro),
        });
      } catch (e) {
        if (!cancelled) toastRef.current?.err?.(e.message || t('profile_load_failed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, t, login]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setEventsLoading(true);
      try {
        const list = await api.events.list(user.id);
        if (!cancelled) setEvents(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.menu.list();
        if (!cancelled) setMenuItems(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setMenuItems([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      try {
        const parsed = readJsonStorageWithLegacy('order_history', [], Array.isArray);
        setOrders(Array.isArray(parsed) ? parsed : []);
      } catch {
        setOrders([]);
      }
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await api.orders.listUser(user.id);
        if (!cancelled) setOrders(Array.isArray(list) ? list : []);
      } catch {
        if (cancelled) return;
        try {
          const parsed = readJsonStorageWithLegacy('order_history', [], Array.isArray);
          setOrders(Array.isArray(parsed) ? parsed : []);
        } catch {
          setOrders([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!user?.id) return;
    if (!form.name.trim()) { toast.err(t('profile_login_required')); return; }
    setSaving(true);
    try {
      const updated = await api.auth.updateProfile(user.id, {
        name: form.name.trim(),
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        birth_date: form.birth_date || '',
      });
      setProfile(updated);
      login({
        ...user,
        name: updated.name || form.name,
        full_name: updated.full_name || form.full_name,
        phone: updated.phone || form.phone,
        birth_date: updated.birth_date || form.birth_date,
        email: updated.email || form.email || user.email,
        avatar_url: updated.vk_avatar_url || user.avatar_url,
        is_pro: Boolean(updated.is_pro ?? user.is_pro),
      });
      toast.ok(t('profile_saved'));
    } catch (e) {
      toast.err(e.message || t('profile_save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const sendEmailCode = async () => {
    if (!user?.id || !form.email) { toast.err(t('profile_email_required')); return; }
    try {
      await api.auth.sendEmailCode(user.id, form.email.trim());
      toast.ok(t('profile_email_code_sent'));
    } catch (e) {
      toast.err(e.message || t('profile_email_code_send_failed'));
    }
  };

  const confirmEmailCode = async () => {
    if (!user?.id || !emailCode.trim()) { toast.err(t('profile_email_code_required')); return; }
    try {
      const updated = await api.auth.confirmEmailCode(user.id, emailCode.trim());
      setProfile(updated);
      login({
        ...user,
        email: updated.email,
        email_verified: Boolean(updated.email_verified),
        avatar_url: updated.vk_avatar_url || user.avatar_url,
      });
      setEmailCode('');
      toast.ok(t('profile_email_verified'));
    } catch (e) {
      toast.err(e.message || t('profile_email_code_invalid'));
    }
  };

  const setPro = async (enabled) => {
    if (!user?.id) return;
    try {
      const updated = await api.auth.setProStatus(user.id, enabled);
      setProfile(updated);
      login({ ...user, is_pro: Boolean(updated.is_pro) });
      toast.ok(enabled ? t('profile_pro_enabled') : t('profile_pro_disabled'));
    } catch (e) {
      toast.err(e.message || t('profile_pro_update_failed'));
    }
  };

  const isPro = Boolean(profile?.is_pro || user?.is_pro);
  const isAdmin = Number(user?.role_id) === 2;

  const favDishes = menuItems.filter(d => favorites.includes(Number(d.id)));

  return (
    <>
      <div className="modal-ov" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal">
          <div className="m-hdr">
            <div className="m-ttl"><span className="ico"><Icons.User /></span>{t('title_profile')}</div>
            <button type="button" className="m-x" onClick={onClose} aria-label={t('close')}>
              <Icons.Close />
            </button>
          </div>
          <div className="m-body">
            {loading ? (
              <p style={{ color: 'var(--muted)' }}>{t('profile_loading')}</p>
            ) : (
              <>
                {profile?.vk_avatar_url && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                    <img
                      src={profile.vk_avatar_url}
                      alt={t('avatar_alt')}
                      style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gold)' }}
                    />
                  </div>
                )}

                <div className="pro-strip">
                  <div className="pro-strip-left">
                    <div className="pro-strip-pill"><Icons.Diamond /> PRO</div>
                    <div className="pro-strip-text">
                      {isPro ? t('profile_vip_active') : t('profile_vip_pitch')}
                    </div>
                  </div>
                  <div className="pro-strip-right">
                    <button type="button" className={isPro ? 'btn btn-outline-gold' : 'btn btn-gold'} onClick={() => setProOpen(true)}>
                      {isPro ? t('profile_manage') : t('profile_upgrade_pro')}
                    </button>
                  </div>
                </div>

                {isAdmin && (
                  <div className="pro-strip" style={{ marginTop: -6 }}>
                    <div className="pro-strip-left">
                      <div className="pro-strip-pill"><Icons.Sliders /> {t('profile_admin')}</div>
                      <div className="pro-strip-text">{t('profile_admin_desc')}</div>
                    </div>
                    <div className="pro-strip-right">
                      <button type="button" className="btn btn-outline-gold" onClick={() => setAdminOpen(true)}>
                        {t('profile_admin_open_panel')}
                      </button>
                    </div>
                  </div>
                )}

                <div className="events-box">
                  <div className="events-h"><Icons.Gift /> {t('profile_events')}</div>
                  {eventsLoading ? (
                    <div className="events-muted">{t('loading')}</div>
                  ) : events.length === 0 ? (
                    <div className="events-muted">{t('profile_events_empty')}</div>
                  ) : (
                    <div className="events-list">
                      {events.slice(0, 3).map((ev) => (
                        <div key={ev.id} className={`event-card${ev.locked ? ' locked' : ''}`}>
                          <div className="event-top">
                            <div className="event-title">
                              {ev.title}
                              {ev.is_private && <span className="event-badge"><Icons.Diamond /> PRO</span>}
                            </div>
                            <div className="event-date">{ev.starts_at ? String(ev.starts_at).slice(0, 10) : t('profile_soon')}</div>
                          </div>
                          <div className="event-desc">{ev.locked ? t('profile_event_locked') : (ev.description || '')}</div>
                          {ev.locked && (
                            <button type="button" className="btn btn-outline-gold" style={{ marginTop: 10 }} onClick={() => setProOpen(true)}>
                              {t('profile_open_in_pro')}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* History / Favorites tabs */}
                <div className="history-box">
                  <div className="history-tabs">
                    <button type="button" className={`history-tab${historyTab === 'orders' ? ' on' : ''}`} onClick={() => setHistoryTab('orders')}>
                      <Icons.Menu /> {t('profile_my_orders')}
                    </button>
                    <button type="button" className={`history-tab${historyTab === 'favorites' ? ' on' : ''}`} onClick={() => setHistoryTab('favorites')}>
                      ♥ Избранное {favDishes.length > 0 && <span style={{ marginLeft: 4, fontSize: 10, background: 'rgba(232,74,95,0.18)', color: '#e84a5f', borderRadius: 999, padding: '1px 6px' }}>{favDishes.length}</span>}
                    </button>
                  </div>

                  {/* Orders with real-time statuses */}
                  {historyTab === 'orders' && (
                    orders.length === 0 ? (
                      <div className="history-empty">{t('profile_orders_empty')}</div>
                    ) : (
                      <div className="history-list">
                        {orders.map(o => {
                          const status = o.status || orderStatuses[String(o.id)] || 'pending';
                          const statusLabel = ORDER_STATUS_LABELS[status] || status;
                          const statusCls = ORDER_STATUS_CLS[status] || 'wait';
                          const emoji = ORDER_STATUS_EMOJI[status] || '🕐';
                          const statusIdx = ORDER_STATUS_FLOW.indexOf(status);
                          return (
                            <div key={o.id} className="history-item">
                              <div className="history-item-top">
                                <span className="history-item-date">
                                  {new Date(o.created_at || o.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="history-item-total">{o.total} ₽</span>
                              </div>
                              {/* Status progress bar */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 6px' }}>
                                <span className={`admin-status ${statusCls}`} style={{ fontSize: 9, padding: '3px 8px', letterSpacing: 1.5 }}>
                                  {emoji} {statusLabel}
                                </span>
                                {status !== 'cancelled' && (
                                  <div style={{ flex: 1, display: 'flex', gap: 3 }}>
                                    {ORDER_STATUS_FLOW.map((s, i) => (
                                      <div
                                        key={s}
                                        style={{
                                          flex: 1,
                                          height: 3,
                                          borderRadius: 999,
                                          background: i <= statusIdx
                                            ? 'var(--gold)'
                                            : 'rgba(255,255,255,0.10)',
                                          transition: 'background 0.4s',
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="history-item-meta">
                                {t('order_history_items', { count: o.items?.reduce((s, i) => s + (Number(i.qty ?? i.quantity) || 0), 0) || 0 })}
                                {' · '}
                                  {o.fulfillment === 'pickup' ? t('order_history_fulfillment_pickup') : t('order_history_fulfillment_delivery')}
                              </div>
                              {o.items?.length > 0 && (
                                <div className="history-item-dishes">
                                  {o.items.map(i => <span key={i.id} className="history-dish-chip">{i.name} ×{i.qty ?? i.quantity ?? 1}</span>)}
                                </div>
                              )}
                              {onRepeatOrder && o.items?.length > 0 && (
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  style={{ marginTop: 10, fontSize: 11, padding: '7px 14px' }}
                                  onClick={() => onRepeatOrder(o.items)}
                                >
                                  ↻ Повторить заказ
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* Favorites */}
                  {historyTab === 'favorites' && (
                    favDishes.length === 0 ? (
                      <div className="history-empty">
                        <div style={{ fontSize: 28, marginBottom: 6 }}>♡</div>
                        Нет избранных товаров. Нажмите ♡ на карточке товара в каталоге, чтобы добавить.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {favDishes.map(dish => (
                          <div key={dish.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            border: '1px solid var(--glass-border)', borderRadius: 12,
                            padding: '10px 12px', background: 'var(--glass)',
                          }}>
                            <img
                              src={dish.img}
                              alt={dish.name}
                              style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                              onError={e => { e.currentTarget.style.display = 'none'; }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {dish.name}
                              </div>
                              <div style={{ color: 'var(--gold)', fontSize: 13, marginTop: 2 }}>{dish.price} ₽</div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ padding: '6px 12px', fontSize: 11 }}
                                onClick={() => onRepeatOrder?.([{ ...dish, qty: 1 }])}
                              >
                                + В корзину
                              </button>
                              <button
                                type="button"
                                style={{
                                  width: 32, height: 32, borderRadius: '50%',
                                  border: '1px solid rgba(232,74,95,0.35)',
                                  background: 'rgba(232,74,95,0.08)',
                                  color: '#e84a5f', fontSize: 15,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                                onClick={() => toggleFav(dish.id)}
                              >
                                ♥
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>

                {/* Profile form */}
                <div className="fg">
                  <div className="fl">{t('auth_username')}</div>
                  <input className="fi" type="text" value={form.name} onChange={(e) => update('name', e.target.value)} />
                </div>
                <div className="fg">
                  <div className="fl">{t('profile_full_name')}</div>
                  <input className="fi" type="text" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} />
                </div>
                <div className="fi-row">
                  <div className="fg">
                    <div className="fl">{t('phone_label')}</div>
                    <input className="fi" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
                  </div>
                  <div className="fg">
                    <div className="fl">{t('profile_birth_date')}</div>
                    <input className="fi" type="date" value={form.birth_date} onChange={(e) => update('birth_date', e.target.value)} />
                  </div>
                </div>

                <div className="fg">
                  <div className="fl">
                    {t('profile_email')}{' '}
                    {profile?.email_verified ? t('profile_email_verified_mark') : t('profile_email_not_verified_mark')}
                  </div>
                  <input className="fi" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@example.com" />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-ghost" onClick={sendEmailCode}>{t('profile_send_code')}</button>
                    <input className="fi" style={{ maxWidth: 140 }} type="text" value={emailCode} onChange={(e) => setEmailCode(e.target.value)} placeholder={t('profile_code')} />
                    <button type="button" className="btn btn-outline-gold" onClick={confirmEmailCode}>{t('auth_confirm')}</button>
                  </div>
                </div>

                <button className="submit" onClick={save} disabled={saving || loading}>
                  {saving ? t('profile_saving') : t('profile_save')}
                </button>
              </>
            )}
          </div>
        </div>

        <style>{`
          .pro-strip{border:1px solid var(--glass-border);border-radius:var(--r-lg);padding:12px 12px;background:radial-gradient(900px 220px at 10% 0%,rgba(201,169,110,0.14),transparent 60%),var(--glass);display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap;}
          .pro-strip-left{display:flex;align-items:center;gap:12px;min-width:0;}
          .pro-strip-pill{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;border:1px solid rgba(201,169,110,0.35);background:rgba(201,169,110,0.08);color:var(--gold2);font-size:10px;letter-spacing:2.6px;text-transform:uppercase;white-space:nowrap;}
          .pro-strip-pill svg{color:var(--gold);}
          .pro-strip-text{color:var(--muted-strong);font-size:12px;line-height:1.5;overflow:hidden;text-overflow:ellipsis;}
          .pro-strip-right{display:flex;align-items:center;gap:10px;flex-shrink:0;}
          .events-box{border:1px solid var(--glass-border);border-radius:var(--r-lg);padding:12px;background:var(--glass);margin:16px 0 18px;}
          .events-h{display:flex;align-items:center;gap:10px;font-family:var(--ff-d);font-size:22px;color:var(--text);margin-bottom:10px;}
          .events-h svg{color:var(--gold);}
          .events-muted{color:var(--muted);font-size:12px;line-height:1.6;}
          .events-list{display:flex;flex-direction:column;gap:10px;}
          .event-card{border:1px solid var(--glass-border);border-radius:14px;padding:10px;background:var(--glass);}
          .event-card.locked{border-color:rgba(201,169,110,0.20);background:radial-gradient(700px 120px at 10% 0%,rgba(201,169,110,0.14),var(--glass));}
          .event-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
          .event-title{color:var(--text);font-size:13px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
          .event-date{color:var(--muted2);font-size:11px;white-space:nowrap;}
          .event-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;border:1px solid rgba(201,169,110,0.35);background:rgba(201,169,110,0.08);color:var(--gold2);font-size:10px;letter-spacing:2px;text-transform:uppercase;}
          .event-badge svg{color:var(--gold);}
          .event-desc{margin-top:6px;color:var(--muted-strong);font-size:12px;line-height:1.55;}
          .history-box{border:1px solid var(--glass-border);border-radius:var(--r-lg);padding:12px;background:var(--glass);margin:0 0 18px;}
          .history-tabs{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;}
          .history-tab{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:999px;border:1px solid var(--glass-border);background:transparent;color:var(--muted);font-size:11px;letter-spacing:1.4px;text-transform:uppercase;cursor:pointer;transition:all .22s var(--ease);}
          .history-tab svg{color:var(--gold);opacity:.7;}
          .history-tab:hover{border-color:rgba(201,169,110,0.35);color:var(--text);}
          .history-tab.on{border-color:rgba(201,169,110,0.5);background:rgba(201,169,110,0.08);color:var(--gold);}
          .history-tab.on svg{opacity:1;}
          .history-empty{color:var(--muted);font-size:12px;padding:6px 0;text-align:center;line-height:1.6;}
          .history-list{display:flex;flex-direction:column;gap:8px;}
          .history-item{border:1px solid var(--glass-border);border-radius:12px;padding:10px 12px;background:var(--glass);}
          .history-item-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;}
          .history-item-date{color:var(--text);font-size:13px;font-weight:500;}
          .history-item-total{color:var(--gold);font-size:14px;font-weight:600;}
          .history-item-meta{color:var(--muted-strong);font-size:12px;line-height:1.5;}
          .history-item-dishes{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;}
          .history-dish-chip{display:inline-block;padding:3px 8px;border-radius:999px;border:1px solid var(--glass-border);background:var(--glass);color:var(--muted-strong);font-size:11px;}
        `}</style>
      </div>

      {proOpen && (
        <ProModal
          isPro={isPro}
          onActivate={() => { setPro(true); setProOpen(false); }}
          onDeactivate={() => { setPro(false); setProOpen(false); }}
          onClose={() => setProOpen(false)}
        />
      )}

      {adminOpen && (
        <AdminModal
          onClose={() => setAdminOpen(false)}
          toast={toast}
          onNavigate={(page) => {
            setAdminOpen(false);
            onClose?.();
            onNavigate?.(page);
          }}
        />
      )}
    </>
  );
}
