import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../hooks/useI18n';
import { Icons } from '../icons/Icons';
import { SLIDES } from '../../utils/heroSlides';
import { makeStorageKey, readJsonStorageWithLegacy } from '../../utils/brand';
import { DICT, DICT_LANGS, getI18nOverrides, setI18nOverrides } from '../../hooks/useI18n';
import { ORDER_STATUS_LABELS, ORDER_STATUS_CLS, ORDER_STATUS_FLOW, getAllOrderStatuses, setOrderStatus } from '../../utils/orderStatus';
import './admin.css';

const HERO_CONFIG_SUFFIX = 'hero_config';
const HERO_CONFIG_KEY = makeStorageKey(HERO_CONFIG_SUFFIX);
const DEFAULT_HERO_CONFIG = SLIDES.map(sl => ({ dishId: sl.dishId, tag: '', desc: '', price: sl.price, weight: sl.weight, mode: 'dish', titleOverride: '', customTitle: '', customImg: '' }));

const ADMIN_LAYOUT_SCALE = 2;
const ADMIN_LAYOUT_W = 480 * ADMIN_LAYOUT_SCALE;
const ADMIN_LAYOUT_H = 320 * ADMIN_LAYOUT_SCALE;
const ADMIN_LAYOUT_MIN_ZOOM = 0.75;
const ADMIN_LAYOUT_MAX_ZOOM = 2.5;

async function downloadImageBlob(url, filename) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    return true;
  } catch {
    return false;
  }
}

function loadHeroConfig() {
  const parsed = readJsonStorageWithLegacy(HERO_CONFIG_SUFFIX, DEFAULT_HERO_CONFIG, Array.isArray);
  return Array.isArray(parsed) ? parsed : DEFAULT_HERO_CONFIG;
}

function clampPercent(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(90, Math.round(n)));
}

function finalPrice(price, discountPercent) {
  const base = Number(price || 0);
  const disc = clampPercent(discountPercent);
  return Math.max(0, Math.round(base * (100 - disc) / 100));
}

function buildSparkPoints(data, w, h, pad = 2) {
  const arr = Array.isArray(data) ? data.map((x) => Number(x) || 0) : [];
  if (arr.length === 0) return '';
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const range = max - min || 1;
  const innerW = Math.max(1, w - pad * 2);
  const innerH = Math.max(1, h - pad * 2);
  const step = arr.length <= 1 ? 0 : innerW / (arr.length - 1);
  return arr
    .map((v, i) => {
      const x = pad + step * i;
      const y = pad + (1 - (v - min) / range) * innerH;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function AdminSparkline({ data, width = 96, height = 26 }) {
  const pts = buildSparkPoints(data, width, height, 2);
  if (!pts) return null;
  return (
    <svg className="admin-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <polyline points={pts} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AdminLineChart({ data, height = 140 }) {
  const w = 100;
  const h = 40;
  const pts = buildSparkPoints(data, w, h, 2);
  if (!pts) return null;
  const area = `${pts} 98,38 2,38`;
  return (
    <svg className="admin-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="adminChartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(201,169,110,0.35)" />
          <stop offset="100%" stopColor="rgba(201,169,110,0.00)" />
        </linearGradient>
      </defs>
      <polyline points={area} fill="url(#adminChartFill)" stroke="none" />
      <polyline points={pts} fill="none" stroke="var(--gold2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AdminModal({ onClose, toast }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState('inbox');
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const listRef = useRef(null);
  const pollRef = useRef(null);

  const [menuLoading, setMenuLoading] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [menuEditingId, setMenuEditingId] = useState(null);
  const [menuUploading, setMenuUploading] = useState(false);
  const menuUploadInputRef = useRef(null);
  const eventUploadInputRef = useRef(null);
  const [eventUploading, setEventUploading] = useState(false);
  const [menuForm, setMenuForm] = useState({
    cat: '',
    name: '',
    price: '',
    weight: '',
    badge: '',
    tags: '',
    img: '',
    desc: '',
    ingr: '',
    is_active: true,
  });
  const [stopQuery, setStopQuery] = useState('');
  const [stopUpdatingId, setStopUpdatingId] = useState(null);

  const [discountDraft, setDiscountDraft] = useState({});
  const [discountUpdatingId, setDiscountUpdatingId] = useState(null);

  const [adminOrdersLoading, setAdminOrdersLoading] = useState(false);
  const [adminOrders, setAdminOrders] = useState([]);
  const [localOrderStatuses, setLocalOrderStatuses] = useState(() => getAllOrderStatuses());
  const [statsQuery, setStatsQuery] = useState('');
  const [statsSort, setStatsSort] = useState('orders24h_desc');

  const [eventsLoading, setEventsLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [eventEditingId, setEventEditingId] = useState(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    starts_at: '',
    image_url: '',
    is_private: false,
  });

  const [adminRestaurantsLoading, setAdminRestaurantsLoading] = useState(false);
  const [adminRestaurants, setAdminRestaurants] = useState([]);
  const [restaurantEditingId, setRestaurantEditingId] = useState(null);
  const [restaurantBusy, setRestaurantBusy] = useState(false);
  const [restaurantForm, setRestaurantForm] = useState({
    name: '',
    address: '',
    phone: '',
  });

  const [adminTablesLoading, setAdminTablesLoading] = useState(false);
  const [adminTablesRestaurantId, setAdminTablesRestaurantId] = useState(null);
  const [adminTables, setAdminTables] = useState([]);
  const [adminTableUpdatingId, setAdminTableUpdatingId] = useState(null);
  const adminLayoutSvgRef = useRef(null);
  const adminLayoutDragRef = useRef(null);
  const adminLayoutPanDragRef = useRef(null);
  const adminLayoutDecorDragRef = useRef(null);
  const [adminLayoutDraggingId, setAdminLayoutDraggingId] = useState(null);
  const [adminLayoutSelectedId, setAdminLayoutSelectedId] = useState(null);
  const [adminLayoutContextMenu, setAdminLayoutContextMenu] = useState(null);
  const adminLayoutContextMenuRef = useRef(null);
  const [adminLayoutDecor, setAdminLayoutDecor] = useState([]);
  const [adminLayoutTool, setAdminLayoutTool] = useState('pan');
  const [adminLayoutDraftText, setAdminLayoutDraftText] = useState('Вход');
  const [adminLayoutSelectedDecorId, setAdminLayoutSelectedDecorId] = useState(null);
  const [adminLayoutZoom, setAdminLayoutZoom] = useState(1);
  const [adminLayoutPan, setAdminLayoutPan] = useState({ x: 0, y: 0 });
  const [tableEditor, setTableEditor] = useState(null);
  const [tableEditorBusy, setTableEditorBusy] = useState(false);

  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewReplyId, setReviewReplyId] = useState(null);
  const [reviewReplyDraft, setReviewReplyDraft] = useState('');
  const [reviewUpdatingId, setReviewUpdatingId] = useState(null);
  const [adminHideOldReviews, setAdminHideOldReviews] = useState(true);

  // Hero slideshow config
  const [heroConfig, setHeroConfig] = useState(loadHeroConfig);
  const [heroSaved, setHeroSaved] = useState(false);
  // Menu items loaded from API for hero picker
  const [heroMenuItems, setHeroMenuItems] = useState([]);

  // Contact messages (from contacts page form, stored in localStorage)
  const [contactMessages, setContactMessages] = useState([]);
  const [selectedContactMsg, setSelectedContactMsg] = useState(null);

  // Translations editor
  const [transLang, setTransLang] = useState('ru');
  const [transSearch, setTransSearch] = useState('');
  const [transOverrides, setTransOverrides] = useState(() => getI18nOverrides());
  const [transSaved, setTransSaved] = useState(false);

  const adminId = user?.id;

  const loadContactMessages = () => {
    try {
      const raw = localStorage.getItem('contact_messages');
      const list = raw ? JSON.parse(raw) : [];
      setContactMessages(Array.isArray(list) ? list : []);
    } catch {
      setContactMessages([]);
    }
  };

  const markContactRead = (id) => {
    try {
      const raw = localStorage.getItem('contact_messages');
      const list = raw ? JSON.parse(raw) : [];
      const updated = list.map(m => m.id === id ? { ...m, read: true } : m);
      localStorage.setItem('contact_messages', JSON.stringify(updated));
      setContactMessages(updated);
    } catch { /* ignore */ }
  };

  const deleteContactMsg = (id) => {
    try {
      const raw = localStorage.getItem('contact_messages');
      const list = raw ? JSON.parse(raw) : [];
      const updated = list.filter(m => m.id !== id);
      localStorage.setItem('contact_messages', JSON.stringify(updated));
      setContactMessages(updated);
      if (selectedContactMsg?.id === id) setSelectedContactMsg(null);
    } catch { /* ignore */ }
  };

  const saveTranslations = () => {
    setI18nOverrides(transOverrides);
    setTransSaved(true);
    setTimeout(() => setTransSaved(false), 2000);
    toast?.ok?.('Переводы сохранены');
  };

  const resetTranslation = (lang, key) => {
    setTransOverrides(prev => {
      const next = { ...prev, [lang]: { ...(prev[lang] || {}) } };
      delete next[lang][key];
      return next;
    });
  };

  const selectedThread = useMemo(() => threads.find((thr) => thr.id === selectedId) || null, [selectedId, threads]);
  const restaurantById = useMemo(() => new Map(adminRestaurants.map((r) => [r.id, r])), [adminRestaurants]);
  const adminLayoutDecorKey = useMemo(
    () => makeStorageKey(`admin_layout_decor_${adminTablesRestaurantId || 'none'}`),
    [adminTablesRestaurantId]
  );

  const reviewsFiltered = useMemo(() => {
    if (!adminHideOldReviews) return reviews;
    const threshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return reviews.filter((r) => {
      const raw = r?.created_at;
      if (!raw) return true;
      const ts = new Date(raw).getTime();
      if (!Number.isFinite(ts)) return true;
      return ts >= threshold;
    });
  }, [adminHideOldReviews, reviews]);

  const stopList = useMemo(() => {
    const q = String(stopQuery || '').trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter((it) => {
      const hay = `${it?.name || ''} ${it?.cat || ''} #${it?.id || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [menuItems, stopQuery]);

  const stopActive = useMemo(() => stopList.filter((it) => Boolean(it?.is_active)), [stopList]);
  const stopInactive = useMemo(() => stopList.filter((it) => !it?.is_active), [stopList]);

  const statsByDish = useMemo(() => {
    const HOUR = 60 * 60 * 1000;
    const now = Date.now();
    const curHourStart = Math.floor(now / HOUR) * HOUR;
    const start48 = curHourStart - 47 * HOUR;
    const byId = new Map();

    const ensure = (id) => {
      const key = String(id);
      let e = byId.get(key);
      if (!e) {
        e = {
          series48: Array.from({ length: 48 }, () => 0),
          revenue48: Array.from({ length: 48 }, () => 0),
          totalQty: 0,
          totalRevenue: 0,
          firstSeenAt: 0,
        };
        byId.set(key, e);
      }
      return e;
    };

    const parseTs = (raw) => {
      if (!raw) return null;
      const ts = new Date(raw).getTime();
      return Number.isFinite(ts) ? ts : null;
    };

    for (const o of Array.isArray(adminOrders) ? adminOrders : []) {
      if (adminTablesRestaurantId && Number(o?.restaurant_id || 0) && Number(o.restaurant_id) !== Number(adminTablesRestaurantId)) {
        continue;
      }
      const ts = parseTs(o?.created_at) ?? parseTs(o?.createdAt) ?? parseTs(o?.fulfillment_time);
      if (!ts) continue;
      const hourStart = Math.floor(ts / HOUR) * HOUR;
      const hourIdx = Math.floor((hourStart - start48) / HOUR);
      const items = Array.isArray(o?.items) ? o.items : [];
      for (const it of items) {
        const id = it?.id;
        if (id == null) continue;
        const qty = Math.max(0, Math.floor(Number(it?.qty ?? it?.quantity ?? 0) || 0));
        if (!qty) continue;
        const price = Number(it?.price);
        const unit = Number.isFinite(price) ? Math.max(0, price) : 0;
        const e = ensure(id);
        e.totalQty += qty;
        e.totalRevenue += unit * qty;
        if (!e.firstSeenAt || ts < e.firstSeenAt) e.firstSeenAt = ts;
        if (hourIdx >= 0 && hourIdx < 48) {
          e.series48[hourIdx] += qty;
          e.revenue48[hourIdx] += unit * qty;
        }
      }
    }

    return byId;
  }, [adminOrders, adminTablesRestaurantId]);

  const statsRows = useMemo(() => {
    const sum = (arr) => (Array.isArray(arr) ? arr.reduce((s, x) => s + (Number(x) || 0), 0) : 0);

    const rows = menuItems.map((it) => {
      const id = it?.id != null ? String(it.id) : '';
      const entry = id ? statsByDish.get(id) : null;
      const series48 = Array.isArray(entry?.series48) ? entry.series48.slice(0, 48) : Array.from({ length: 48 }, () => 0);
      const revenue48 = Array.isArray(entry?.revenue48) ? entry.revenue48.slice(0, 48) : Array.from({ length: 48 }, () => 0);
      const prev24 = sum(series48.slice(0, 24));
      const last24 = sum(series48.slice(24));
      const last1 = series48[47] || 0;
      const delta24h = last24 - prev24;
      const trend = delta24h > 0 ? 'up' : delta24h < 0 ? 'down' : 'flat';

      const firstSeenAt = Number(entry?.firstSeenAt || 0);
      const ageH = firstSeenAt ? Math.max(0, (Date.now() - firstSeenAt) / (60 * 60 * 1000)) : 0;

      const curDisc = clampPercent(it.discount_percent || 0);
      const basePrice = Number(it.price || 0);
      const priceNow = finalPrice(basePrice, curDisc);

      const totalOrders = Math.max(0, Math.floor(Number(entry?.totalQty ?? (prev24 + last24))));
      const revenue24hRaw = sum(revenue48.slice(24));
      const revenuePrev24hRaw = sum(revenue48.slice(0, 24));
      const revenue24h = revenue24hRaw > 0 ? revenue24hRaw : (priceNow * last24);
      const revenuePrev24h = revenuePrev24hRaw > 0 ? revenuePrev24hRaw : (priceNow * prev24);

      return {
        it,
        series48,
        series24: series48.slice(24),
        totalOrders,
        orders24h: last24,
        ordersPrev24h: prev24,
        orders1h: last1,
        delta24h,
        trend,
        ageH,
        firstSeenAt,
        priceNow,
        revenue24h,
        revenuePrev24h,
      };
    });

    const max24 = rows.reduce((m, r) => Math.max(m, r.orders24h || 0), 0) || 1;
    return rows.map((r) => {
      const demand = (r.orders24h || 0) / max24;
      let suggested = 0;
      if (demand < 0.12) suggested = 30;
      else if (demand < 0.22) suggested = 25;
      else if (demand < 0.35) suggested = 20;
      else if (demand < 0.55) suggested = 10;
      else if (demand < 0.75) suggested = 5;

      const demandTier = demand >= 0.72 ? 'high' : demand >= 0.42 ? 'mid' : 'low';
      return { ...r, demand, demandTier, suggestedDiscount: suggested };
    });
  }, [menuItems, statsByDish]);

  const statsFilteredSorted = useMemo(() => {
    const q = String(statsQuery || '').trim().toLowerCase();
    const filtered = !q ? statsRows : statsRows.filter((r) => {
      const it = r.it || {};
      const hay = `${it?.name || ''} ${it?.cat || ''} #${it?.id || ''}`.toLowerCase();
      return hay.includes(q);
    });

    const list = filtered.slice();
    if (statsSort === 'name_asc') return list.sort((a, b) => String(a.it?.name || '').localeCompare(String(b.it?.name || '')));
    if (statsSort === 'revenue24h_desc') return list.sort((a, b) => (b.revenue24h || 0) - (a.revenue24h || 0));
    if (statsSort === 'orders_total_desc') return list.sort((a, b) => (b.totalOrders || 0) - (a.totalOrders || 0));
    // default: orders24h desc
    return list.sort((a, b) => (b.orders24h || 0) - (a.orders24h || 0));
  }, [statsQuery, statsRows, statsSort]);

  const statsSummary = useMemo(() => {
    const totalByHour = Array.from({ length: 24 }, (_, idx) => statsRows.reduce((s, r) => s + (Number(r.series24?.[idx]) || 0), 0));
    const total24h = totalByHour.reduce((s, x) => s + (Number(x) || 0), 0);
    const totalPrev24h = statsRows.reduce((s, r) => s + (Number(r.ordersPrev24h) || 0), 0);
    const delta24h = total24h - totalPrev24h;

    const byCat = new Map();
    for (const r of statsRows) {
      const cat = String(r.it?.cat || '');
      if (!cat) continue;
      byCat.set(cat, (byCat.get(cat) || 0) + (Number(r.orders24h) || 0));
    }
    const cats = Array.from(byCat.entries()).map(([cat, orders]) => ({ cat, orders }))
      .sort((a, b) => b.orders - a.orders);

    const newDishes = statsRows
      .filter((r) => (Number(r.totalOrders || 0) > 0) && (Number(r.ageH || 0) < 24))
      .sort((a, b) => (a.firstSeenAt || 0) - (b.firstSeenAt || 0));

    return { totalByHour, total24h, totalPrev24h, delta24h, cats, newDishes };
  }, [statsRows]);

  const loadThreads = async () => {
    if (!adminId) return;
    setLoadingThreads(true);
    try {
      const list = await api.support.adminListThreads(adminId);
      setThreads(Array.isArray(list) ? list : []);
      if (!selectedId && Array.isArray(list) && list[0]) setSelectedId(list[0].id);
    } catch (e) {
      toast?.err?.(e.message || t('admin_err_load_threads'));
    } finally {
      setLoadingThreads(false);
    }
  };

  const loadMessages = async (threadId) => {
    if (!adminId || !threadId) return;
    setLoadingMessages(true);
    try {
      const list = await api.support.adminListMessages(threadId, adminId);
      setMessages(Array.isArray(list) ? list : []);
    } catch (e) {
      toast?.err?.(e.message || t('admin_err_load_messages'));
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (!adminId) return;
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId]);

  useEffect(() => {
    if (tab !== 'inbox') return;
    if (!selectedId) return;
    loadMessages(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedId]);

  useEffect(() => {
    if (tab !== 'inbox' || !adminId) return;
    pollRef.current = setInterval(() => {
      loadThreads();
      if (selectedId) loadMessages(selectedId);
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, adminId, selectedId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    if (!adminId || !selectedId) return;
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    try {
      await api.support.adminSendMessage(selectedId, adminId, text);
      await loadMessages(selectedId);
      await loadThreads();
    } catch (e) {
      toast?.err?.(e.message || t('admin_err_send_message'));
    }
  };

  const aiReply = async () => {
    if (!adminId || !selectedId) return;
    try {
      await api.ai.adminReply(selectedId, adminId);
      await loadMessages(selectedId);
      await loadThreads();
    } catch (e) {
      toast?.err?.(e.message || t('admin_err_ai_unavailable'));
    }
  };

  const loadMenu = async () => {
    if (!adminId) return;
    setMenuLoading(true);
    try {
      const list = await api.menu.adminList(adminId);
      setMenuItems(Array.isArray(list) ? list : []);
    } catch (e) {
      toast?.err?.(e.message || t('admin_err_load_menu'));
    } finally {
      setMenuLoading(false);
    }
  };

  const loadAdminOrders = async () => {
    if (!adminId) return;
    setAdminOrdersLoading(true);
    try {
      const list = await api.admin.orders.list(adminId);
      setAdminOrders(Array.isArray(list) ? list : []);
    } catch (e) {
      toast?.err?.(e.message || t('admin_table_action_failed'));
      setAdminOrders([]);
    } finally {
      setAdminOrdersLoading(false);
    }
  };

  const toggleMenuActive = async (it, nextActive) => {
    if (!adminId || !it?.id) return;
    setStopUpdatingId(it.id);
    const prevActive = Boolean(it.is_active);
    setMenuItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, is_active: Boolean(nextActive) } : x)));
    try {
      await api.menu.adminUpdate(adminId, it.id, { is_active: Boolean(nextActive) });
      toast?.ok?.(nextActive ? t('admin_stoplist_restored') : t('admin_stoplist_added'));
    } catch (e) {
      setMenuItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, is_active: prevActive } : x)));
      toast?.err?.(e.message || t('admin_err_toggle_stoplist'));
    } finally {
      setStopUpdatingId(null);
    }
  };

  const applyDiscount = async (it, rawPercent) => {
    if (!adminId || !it?.id) return;
    const percent = clampPercent(rawPercent);
    setDiscountUpdatingId(it.id);
    const prev = clampPercent(it.discount_percent || 0);
    setMenuItems((p) => p.map((x) => (x.id === it.id ? { ...x, discount_percent: percent } : x)));
    try {
      await api.menu.adminUpdate(adminId, it.id, { discount_percent: percent });
      toast?.ok?.(percent ? t('admin_discount_applied', { percent }) : t('admin_discount_cleared'));
    } catch (e) {
      setMenuItems((p) => p.map((x) => (x.id === it.id ? { ...x, discount_percent: prev } : x)));
      toast?.err?.(e.message || t('admin_err_discount'));
    } finally {
      setDiscountUpdatingId(null);
    }
  };

  const startCreateMenu = () => {
    setMenuEditingId(null);
    setMenuForm({
      cat: '',
      name: '',
      price: '',
      weight: '',
      badge: '',
      tags: '',
      img: '',
      desc: '',
      ingr: '',
      is_active: true,
    });
  };

  const startEditMenu = (item) => {
    setMenuEditingId(item.id);
    setMenuForm({
      cat: item.cat || '',
      name: item.name || '',
      price: String(item.price ?? ''),
      weight: item.weight || '',
      badge: item.badge || '',
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
      img: item.img || '',
      desc: item.desc || '',
      ingr: item.ingr || '',
      is_active: Boolean(item.is_active),
    });
  };

  const saveMenu = async () => {
    if (!adminId) return;
    const payload = {
      cat: menuForm.cat.trim(),
      name: menuForm.name.trim(),
      price: Number(menuForm.price || 0),
      weight: menuForm.weight.trim() || null,
      badge: menuForm.badge.trim() || null,
      tags: menuForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
      img: menuForm.img.trim() || null,
      desc: menuForm.desc.trim() || null,
      ingr: menuForm.ingr.trim() || null,
      is_active: Boolean(menuForm.is_active),
    };
    if (!payload.cat || !payload.name) {
      toast?.err?.(t('admin_err_menu_required'));
      return;
    }
    try {
      if (menuEditingId) await api.menu.adminUpdate(adminId, menuEditingId, payload);
      else await api.menu.adminCreate(adminId, payload);
      toast?.ok?.(t('admin_saved'));
      await loadMenu();
      startCreateMenu();
    } catch (e) {
      toast?.err?.(e.message || t('admin_err_save'));
    }
  };

  const delMenu = async (itemId) => {
    if (!adminId) return;
    if (!window.confirm(t('admin_confirm_delete_dish'))) return;
    try {
      await api.menu.adminDelete(adminId, itemId);
      toast?.ok?.(t('admin_deleted'));
      await loadMenu();
      if (menuEditingId === itemId) startCreateMenu();
    } catch (e) {
      toast?.err?.(e.message || t('admin_err_delete'));
    }
  };

  const handleMenuImageUpload = async (file) => {
    if (!adminId || !file) return;
    setMenuUploading(true);
    try {
      const uploaded = await api.uploads.image(adminId, file, 'menu');
      setMenuForm((prev) => ({ ...prev, img: String(uploaded?.url || '') }));
      toast?.ok?.('Изображение загружено');
    } catch (e) {
      toast?.err?.(e.message || 'Не удалось загрузить изображение');
    } finally {
      setMenuUploading(false);
    }
  };

  const handleEventImageUpload = async (file) => {
    if (!adminId || !file) return;
    setEventUploading(true);
    try {
      const uploaded = await api.uploads.image(adminId, file, 'menu');
      setEventForm((prev) => ({ ...prev, image_url: String(uploaded?.url || '') }));
      toast?.ok?.('Изображение загружено');
    } catch (e) {
      toast?.err?.(e.message || 'Не удалось загрузить изображение');
    } finally {
      setEventUploading(false);
    }
  };

  const loadEvents = async () => {
    if (!adminId) return;
    setEventsLoading(true);
    try {
      const list = await api.events.list(adminId);
      setEvents(Array.isArray(list) ? list : []);
    } catch (e) {
      toast?.err?.(e.message || t('admin_err_load_events'));
    } finally {
      setEventsLoading(false);
    }
  };

  const loadReviews = async () => {
    if (!adminId) return;
    setReviewsLoading(true);
    try {
      const list = await api.reviews.list(false);
      setReviews(Array.isArray(list) ? list : []);
    } catch (e) {
      toast?.err?.(e.message || t('admin_reviews_load_err'));
    } finally {
      setReviewsLoading(false);
    }
  };

  // Load API menu items for hero picker when hero tab opened
  const loadHeroMenuItems = async () => {
    try {
      const list = await api.menu.list();
      if (Array.isArray(list) && list.length > 0) setHeroMenuItems(list);
    } catch { /* keep picker empty until API is available */ }
  };

  const saveHeroConfig = () => {
    try {
      const json = JSON.stringify(heroConfig);
      localStorage.setItem(HERO_CONFIG_KEY, json);
      // Manually dispatch storage event so HeroPage in same tab reacts
      window.dispatchEvent(new StorageEvent('storage', { key: HERO_CONFIG_KEY, newValue: json }));
      setHeroSaved(true);
      setTimeout(() => setHeroSaved(false), 2000);
      toast?.ok?.(t('admin_hero_saved'));
    } catch { /**/ }
  };

  const resetHeroConfig = () => {
    setHeroConfig(DEFAULT_HERO_CONFIG);
    try {
      localStorage.removeItem(HERO_CONFIG_KEY);
      window.dispatchEvent(new StorageEvent('storage', { key: HERO_CONFIG_KEY, newValue: null }));
    } catch { /**/ }
    toast?.ok?.(t('admin_hero_reset'));
  };

  const updateHeroSlot = (index, field, value) => {
    setHeroConfig(prev => prev.map((slot, i) => i === index ? { ...slot, [field]: value } : slot));
  };

  const handleReviewReply = async (reviewId) => {
    if (!adminId || !reviewReplyDraft.trim()) return;
    setReviewUpdatingId(reviewId);
    try {
      const updated = await api.reviews.adminReply(adminId, reviewId, reviewReplyDraft.trim());
      setReviews(prev => prev.map(r => r.id === reviewId ? updated : r));
      setReviewReplyId(null);
      setReviewReplyDraft('');
      toast?.ok?.(t('admin_reviews_replied'));
    } catch (e) {
      toast?.err?.(e.message || t('admin_reviews_err'));
    } finally {
      setReviewUpdatingId(null);
    }
  };

  const handleReviewFeature = async (reviewId, current) => {
    if (!adminId) return;
    setReviewUpdatingId(reviewId);
    try {
      const updated = await api.reviews.adminFeature(adminId, reviewId, !current);
      setReviews(prev => prev.map(r => r.id === reviewId ? updated : r));
      toast?.ok?.(current ? t('admin_reviews_unfeatured_ok') : t('admin_reviews_featured_ok'));
    } catch (e) {
      toast?.err?.(e.message || t('admin_reviews_err'));
    } finally {
      setReviewUpdatingId(null);
    }
  };

  const handleReviewDelete = async (reviewId) => {
    if (!adminId) return;
    if (!window.confirm(t('admin_reviews_confirm_delete'))) return;
    setReviewUpdatingId(reviewId);
    try {
      await api.reviews.adminDelete(adminId, reviewId);
      setReviews(prev => prev.filter(r => r.id !== reviewId));
      toast?.ok?.(t('admin_reviews_deleted'));
    } catch (e) {
      toast?.err?.(e.message || t('admin_reviews_err'));
    } finally {
      setReviewUpdatingId(null);
    }
  };

  const startCreateEvent = () => {
    setEventEditingId(null);
    setEventForm({
      title: '',
      description: '',
      starts_at: '',
      image_url: '',
      is_private: false,
    });
  };

  const startEditEvent = (ev) => {
    setEventEditingId(ev.id);
    setEventForm({
      title: ev.title || '',
      description: ev.description || '',
      starts_at: ev.starts_at ? String(ev.starts_at).slice(0, 16) : '',
      image_url: ev.image_url || '',
      is_private: Boolean(ev.is_private),
    });
  };

  const saveEvent = async () => {
    if (!adminId) return;
    const payload = {
      title: eventForm.title.trim(),
      description: eventForm.description.trim() || null,
      starts_at: eventForm.starts_at ? new Date(eventForm.starts_at).toISOString() : null,
      image_url: eventForm.image_url.trim() || null,
      is_private: Boolean(eventForm.is_private),
    };
    if (!payload.title) {
      toast?.err?.(t('admin_err_event_title_required'));
      return;
    }
    try {
      if (eventEditingId) await api.events.adminUpdate(adminId, eventEditingId, payload);
      else await api.events.adminCreate(adminId, payload);
      toast?.ok?.(t('admin_event_saved'));
      await loadEvents();
      startCreateEvent();
    } catch (e) {
      toast?.err?.(e.message || t('admin_err_save_event'));
    }
  };

  const delEvent = async (eventId) => {
    if (!adminId) return;
    if (!window.confirm(t('admin_confirm_delete_event'))) return;
    try {
      await api.events.adminDelete(adminId, eventId);
      toast?.ok?.(t('admin_deleted'));
      await loadEvents();
      if (eventEditingId === eventId) startCreateEvent();
    } catch (e) {
      toast?.err?.(e.message || t('admin_err_delete_event'));
    }
  };

  const loadAdminRestaurants = async () => {
    setAdminRestaurantsLoading(true);
    try {
      const list = await api.restaurants.list();
      setAdminRestaurants(Array.isArray(list) ? list : []);
    } catch {
      setAdminRestaurants([]);
    } finally {
      setAdminRestaurantsLoading(false);
    }
  };

  const startCreateRestaurant = () => {
    setRestaurantEditingId(null);
    setRestaurantForm({ name: '', address: '', phone: '' });
  };

  const startEditRestaurant = (item) => {
    setRestaurantEditingId(item?.id || null);
    setRestaurantForm({
      name: item?.name || '',
      address: item?.address || '',
      phone: item?.phone || '',
    });
  };

  const saveRestaurant = async () => {
    if (!adminId) return;
    const payload = {
      name: String(restaurantForm.name || '').trim(),
      address: String(restaurantForm.address || '').trim(),
      phone: String(restaurantForm.phone || '').trim() || null,
    };
    if (!payload.name || !payload.address) {
      toast?.err?.('Укажите название и адрес магазина');
      return;
    }
    setRestaurantBusy(true);
    try {
      if (restaurantEditingId) await api.restaurants.adminUpdate(adminId, restaurantEditingId, payload);
      else await api.restaurants.adminCreate(adminId, payload);
      await loadAdminRestaurants();
      startCreateRestaurant();
      toast?.ok?.('Магазин сохранён');
    } catch (e) {
      toast?.err?.(e.message || 'Не удалось сохранить магазин');
    } finally {
      setRestaurantBusy(false);
    }
  };

  const deleteRestaurant = async (item) => {
    if (!adminId || !item?.id) return;
    if (!window.confirm(`Удалить магазин "${item.address || item.name}"?`)) return;
    setRestaurantBusy(true);
    try {
      await api.restaurants.adminDelete(adminId, item.id);
      await loadAdminRestaurants();
      if (restaurantEditingId === item.id) startCreateRestaurant();
      if (adminTablesRestaurantId === item.id) {
        setAdminTablesRestaurantId(null);
        setAdminTables([]);
      }
      toast?.ok?.('Магазин удалён');
    } catch (e) {
      toast?.err?.(e.message || 'Не удалось удалить магазин');
    } finally {
      setRestaurantBusy(false);
    }
  };

  const loadAdminTables = async (restaurantId) => {
    if (!restaurantId) {
      setAdminTables([]);
      return;
    }
    setAdminTablesLoading(true);
    try {
      const list = await api.restaurants.tables(restaurantId);
      const rows = Array.isArray(list) ? list : [];
      const sorted = rows.slice().sort((a, b) => {
        const na = String(a?.name || '').match(/(\d+)/);
        const nb = String(b?.name || '').match(/(\d+)/);
        const va = na ? Number(na[1]) : Number.MAX_SAFE_INTEGER;
        const vb = nb ? Number(nb[1]) : Number.MAX_SAFE_INTEGER;
        return va - vb;
      });
      setAdminTables(sorted);
    } catch (e) {
      toast?.err?.(e.message || t('admin_err_load_tables'));
      setAdminTables([]);
    } finally {
      setAdminTablesLoading(false);
    }
  };

  const toggleTableBlocked = async (tbl) => {
    if (!adminId || !tbl?.id) return;
    setAdminTableUpdatingId(tbl.id);
    try {
      const updated = await api.admin.tables.setBlocked(adminId, tbl.id, !tbl.is_blocked);
      setAdminTables((prev) => prev.map((t) => (t.id === tbl.id ? { ...t, is_blocked: Boolean(updated?.is_blocked) } : t)));
      toast?.ok?.(updated?.is_blocked ? t('admin_table_blocked') : t('admin_table_unblocked'));
    } catch (e) {
      toast?.err?.(e.message || t('admin_err_toggle_table'));
    } finally {
      setAdminTableUpdatingId(null);
    }
  };

  useEffect(() => {
    if (tab !== 'tables') return;
    // Close editor when restaurant changes to avoid mismatched edits.
    setTableEditor(null);
  }, [adminTablesRestaurantId, tab]);

  const nextTableName = useMemo(() => {
    const nums = adminTables
      .map((t) => String(t?.name || '').match(/(\d+)/))
      .map((m) => (m ? Number(m[1]) : null))
      .filter((n) => Number.isFinite(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return `Table ${max + 1}`;
  }, [adminTables]);

  const openCreateTable = (preset = {}) => {
    if (!adminTablesRestaurantId) return;
    const seats = Number(preset.seats || 4);
    const kind = preset.kind || 'standard';
    const scale = typeof preset.scale === 'number' ? preset.scale : 1;
    setTableEditor({
      mode: 'create',
      id: null,
      name: preset.name || nextTableName,
      seats: Math.max(2, Math.min(5, Number.isFinite(seats) ? seats : 4)),
      kind,
      scale,
    });
  };

  const openEditTable = (tbl) => {
    if (!tbl?.id) return;
    setTableEditor({
      mode: 'edit',
      id: tbl.id,
      name: tbl.name || '',
      seats: Math.max(2, Math.min(5, Number(tbl.seats) || 2)),
      kind: (tbl.kind || 'standard'),
      scale: (tbl.scale == null ? 1 : Number(tbl.scale) || 1),
    });
  };

  const saveTableEditor = async () => {
    if (!adminId) return;
    if (!tableEditor) return;
    if (!adminTablesRestaurantId && tableEditor.mode === 'create') return;
    const name = String(tableEditor.name || '').trim();
    if (!name) return;
    const seats = Math.max(2, Math.min(5, Number(tableEditor.seats) || 2));
    const kind = String(tableEditor.kind || 'standard').trim().toLowerCase();
    const scale = Number(tableEditor.scale);
    setTableEditorBusy(true);
    try {
      if (tableEditor.mode === 'create') {
        const created = await api.admin.tables.create(adminId, {
          restaurant_id: adminTablesRestaurantId,
          name,
          seats,
          kind,
          scale: Number.isFinite(scale) ? scale : 1,
        });
        setAdminTables((prev) => [...prev, created].slice().sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0)));
        toast?.ok?.(t('admin_table_created'));
        setTableEditor(null);
      } else {
        const updated = await api.admin.tables.setMeta(adminId, tableEditor.id, {
          name,
          seats,
          kind,
          scale: Number.isFinite(scale) ? scale : 1,
        });
        setAdminTables((prev) => prev.map((x) => (x.id === tableEditor.id ? { ...x, ...updated } : x)));
        toast?.ok?.(t('admin_table_updated'));
      }
    } catch (e) {
      toast?.err?.(e?.message || t('admin_table_action_failed'));
    } finally {
      setTableEditorBusy(false);
    }
  };

  const deleteTable = async (tbl) => {
    if (!adminId || !tbl?.id) return;
    if (!window.confirm(t('admin_table_delete_confirm'))) return;
    setTableEditorBusy(true);
    try {
      await api.admin.tables.remove(adminId, tbl.id);
      setAdminTables((prev) => prev.filter((x) => x.id !== tbl.id));
      toast?.ok?.(t('admin_table_deleted'));
      setTableEditor((prev) => (prev?.id === tbl.id ? null : prev));
    } catch (e) {
      toast?.err?.(e?.message || t('admin_table_action_failed'));
    } finally {
      setTableEditorBusy(false);
    }
  };

  const deleteAllTablesForRestaurant = async () => {
    if (!adminId || !adminTablesRestaurantId) return;
    const confirmed1 = window.confirm('Удалить ВСЕ товары для этого магазина?\n\nЭто действие нельзя отменить.');
    if (!confirmed1) return;
    const confirmed2 = window.confirm('ВНИМАНИЕ! Это удалит ' + adminTables.length + ' товар(ов).\n\nНажмите OK ещё раз для подтверждения.');
    if (!confirmed2) return;
    setTableEditorBusy(true);
    try {
      const res = await api.admin.tables.removeAllForRestaurant(adminId, adminTablesRestaurantId);
      setAdminTables([]);
      setTableEditor(null);
      toast?.ok?.(t('admin_table_delete_all_done', { count: res?.deleted ?? 0 }));
    } catch (e) {
      toast?.err?.(e?.message || t('admin_table_action_failed'));
    } finally {
      setTableEditorBusy(false);
    }
  };

  const duplicateTable = async (tbl) => {
    if (!adminId || !adminTablesRestaurantId || !tbl?.id) return;
    setTableEditorBusy(true);
    try {
      const created = await api.admin.tables.create(adminId, {
        restaurant_id: adminTablesRestaurantId,
        name: `${tbl.name} (copy)`,
        seats: tbl.seats,
        kind: tbl.kind,
        scale: tbl.scale,
      });
      // Offset the duplicate slightly
      const offsetX = Number.isFinite(Number(tbl.x)) ? Number(tbl.x) + 20 : 260;
      const offsetY = Number.isFinite(Number(tbl.y)) ? Number(tbl.y) + 20 : 180;
      await api.admin.tables.setLayout(adminId, created.id, offsetX, offsetY);
      setAdminTables(prev => [...prev, { ...created, x: offsetX, y: offsetY }].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0)));
      toast?.ok?.('Товар скопирован');
      setAdminLayoutContextMenu(null);
    } catch (e) {
      toast?.err?.(e?.message || t('admin_table_action_failed'));
    } finally {
      setTableEditorBusy(false);
    }
  };

  const rotateDecor = (decorId, degrees = 15) => {
    setAdminLayoutDecor((prev) => prev.map((item) => {
      if (item.id !== decorId) return item;
      const currentRot = Number(item.rotation || 0);
      const newRot = (currentRot + degrees) % 360;
      return { ...item, rotation: newRot };
    }));
  };

  const deleteAllDecor = () => {
    if (adminLayoutDecor.length === 0) return;
    if (!window.confirm(`Удалить все ${adminLayoutDecor.length} элементов конструктора?\n\nЭто действие нельзя отменить.`)) return;
    setAdminLayoutDecor([]);
    setAdminLayoutSelectedDecorId(null);
    toast?.ok?.(`Удалено ${adminLayoutDecor.length} элементов`);
  };

  const quickAddTable = async (preset) => {
    if (!adminId || !adminTablesRestaurantId || tableEditorBusy) return;
    const kind = preset.kind || 'standard';
    const seats = preset.seats || 2;
    const scale = preset.scale || 1;
    const bar = kind === 'bar';
    const usedNums = new Set(adminTables.map(tbl => {
      const m = String(tbl.name || '').match(/(\d+)/);
      return m ? Number(m[1]) : null;
    }).filter(n => n !== null));
    let n = bar ? 100 : 1;
    while (usedNums.has(n)) n++;
    const name = `T${n}`;
    setTableEditorBusy(true);
    try {
      const created = await api.admin.tables.create(adminId, {
        restaurant_id: adminTablesRestaurantId,
        name, seats, kind, scale,
      });
      await api.admin.tables.setLayout(adminId, created.id, 240, 160);
      setAdminTables(prev => [...prev, { ...created, x: 240, y: 160 }].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0)));
      toast?.ok?.(t('admin_table_created'));
    } catch (e) {
      toast?.err?.(e?.message || t('admin_table_action_failed'));
    } finally {
      setTableEditorBusy(false);
    }
  };

  const adminLayoutParams = useMemo(() => {
    const variant = adminTablesRestaurantId ? (Number(adminTablesRestaurantId) % 3) : 0;
    const baseCx = 240;
    const baseCy = 160;
    const rotDeg = variant === 1 ? 6 : variant === 2 ? -6 : 0;
    const rot = (rotDeg * Math.PI) / 180;
    const sin = rot ? Math.sin(rot) : 0;
    const cos = rot ? Math.cos(rot) : 1;
    const shiftX = variant === 1 ? 8 : variant === 2 ? -8 : 0;
    const shiftY = variant === 1 ? -4 : variant === 2 ? 6 : 0;
    return { variant, baseCx, baseCy, rot, sin, cos, shiftX, shiftY };
  }, [adminTablesRestaurantId]);

  const adminLayoutDisplayFor = useCallback((tbl, fallbackIndex) => {
    const cx = 240;
    const cy = 160;
    const gapScaleX = 1.28;
    const gapScaleY = 1.38;
    const x0 = Number(tbl?.x);
    const y0 = Number(tbl?.y);
    const hasRaw = Number.isFinite(x0) && Number.isFinite(y0);
    let x = hasRaw ? (x0 - cx) * gapScaleX + cx : null;
    let y = hasRaw ? (y0 - cy) * gapScaleY + cy : null;

    if (x == null || y == null) {
      const fallbackCols = 4;
      const fallbackStartX = 72;
      const fallbackStartY = 68;
      const fallbackStepX = 92;
      const fallbackStepY = 72;
      const i = Math.max(0, Number(fallbackIndex) || 0);
      const col = i % fallbackCols;
      const row = Math.floor(i / fallbackCols);
      x = fallbackStartX + col * fallbackStepX;
      y = fallbackStartY + row * fallbackStepY;
    }

    const { baseCx, baseCy, sin, cos, shiftX, shiftY } = adminLayoutParams;
    const dx = x - baseCx;
    const dy = y - baseCy;
    const xr = baseCx + dx * cos - dy * sin + shiftX;
    const yr = baseCy + dx * sin + dy * cos + shiftY;
    return { x: xr * ADMIN_LAYOUT_SCALE, y: yr * ADMIN_LAYOUT_SCALE };
  }, [adminLayoutParams]);

  const adminLayoutClampPan = useCallback((pan, zoom) => {
    const z = Math.max(ADMIN_LAYOUT_MIN_ZOOM, Math.min(ADMIN_LAYOUT_MAX_ZOOM, Number(zoom) || 1));
    const vbW = ADMIN_LAYOUT_W / z;
    const vbH = ADMIN_LAYOUT_H / z;
    const maxX = Math.max(0, ADMIN_LAYOUT_W - vbW);
    const maxY = Math.max(0, ADMIN_LAYOUT_H - vbH);
    const x = Math.max(0, Math.min(maxX, Number(pan?.x) || 0));
    const y = Math.max(0, Math.min(maxY, Number(pan?.y) || 0));
    return { x, y };
  }, []);

  const adminLayoutViewBox = useMemo(() => {
    const z = Math.max(ADMIN_LAYOUT_MIN_ZOOM, Math.min(ADMIN_LAYOUT_MAX_ZOOM, Number(adminLayoutZoom) || 1));
    const pan = adminLayoutClampPan(adminLayoutPan, z);
    const vbW = ADMIN_LAYOUT_W / z;
    const vbH = ADMIN_LAYOUT_H / z;
    return { x: pan.x, y: pan.y, w: vbW, h: vbH, z, str: `${pan.x} ${pan.y} ${vbW} ${vbH}` };
  }, [adminLayoutClampPan, adminLayoutPan, adminLayoutZoom]);

  const adminLayoutSetZoom = useCallback((nextZoom) => {
    const z = Math.max(ADMIN_LAYOUT_MIN_ZOOM, Math.min(ADMIN_LAYOUT_MAX_ZOOM, Number(nextZoom) || 1));
    setAdminLayoutPan((prev) => {
      const curZ = Math.max(ADMIN_LAYOUT_MIN_ZOOM, Math.min(ADMIN_LAYOUT_MAX_ZOOM, Number(adminLayoutZoom) || 1));
      const curW = ADMIN_LAYOUT_W / curZ;
      const curH = ADMIN_LAYOUT_H / curZ;
      const cx = (Number(prev?.x) || 0) + curW / 2;
      const cy = (Number(prev?.y) || 0) + curH / 2;
      const nextW = ADMIN_LAYOUT_W / z;
      const nextH = ADMIN_LAYOUT_H / z;
      return adminLayoutClampPan({ x: cx - nextW / 2, y: cy - nextH / 2 }, z);
    });
    setAdminLayoutZoom(z);
  }, [adminLayoutClampPan, adminLayoutZoom]);

  const adminLayoutZoomAt = useCallback((pt, nextZoom) => {
    const z = Math.max(ADMIN_LAYOUT_MIN_ZOOM, Math.min(ADMIN_LAYOUT_MAX_ZOOM, Number(nextZoom) || 1));
    const vb = adminLayoutViewBox;
    const relX = vb.w ? (pt.x - vb.x) / vb.w : 0.5;
    const relY = vb.h ? (pt.y - vb.y) / vb.h : 0.5;
    const nextW = ADMIN_LAYOUT_W / z;
    const nextH = ADMIN_LAYOUT_H / z;
    const nextPan = adminLayoutClampPan({ x: pt.x - relX * nextW, y: pt.y - relY * nextH }, z);
    setAdminLayoutZoom(z);
    setAdminLayoutPan(nextPan);
  }, [adminLayoutClampPan, adminLayoutViewBox]);

  const adminLayoutClientToSvg = (clientX, clientY) => {
    const svg = adminLayoutSvgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: (clientX - rect.left) * (adminLayoutViewBox.w / rect.width) + adminLayoutViewBox.x,
      y: (clientY - rect.top) * (adminLayoutViewBox.h / rect.height) + adminLayoutViewBox.y,
    };
  };

  const makeDecorId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const moveDecorBy = useCallback((item, dx, dy) => {
    if (!item) return item;
    if (item.type === 'wall' || item.type === 'door' || item.type === 'window') {
      return {
        ...item,
        x1: Number(item.x1 || 0) + dx,
        y1: Number(item.y1 || 0) + dy,
        x2: Number(item.x2 || 0) + dx,
        y2: Number(item.y2 || 0) + dy,
      };
    }
    return {
      ...item,
      x: Number(item.x || 0) + dx,
      y: Number(item.y || 0) + dy,
    };
  }, []);

  const addDecorAtPoint = useCallback((pt) => {
    if (!pt || !adminTablesRestaurantId) return;
    const base = { id: makeDecorId(), color: 'rgba(201,169,110,0.88)', rotation: 0 };
    let next = null;
    if (adminLayoutTool === 'wall') {
      next = { ...base, type: 'wall', x1: pt.x - 64, y1: pt.y, x2: pt.x + 64, y2: pt.y };
    } else if (adminLayoutTool === 'window') {
      next = { ...base, type: 'window', x1: pt.x - 54, y1: pt.y, x2: pt.x + 54, y2: pt.y, color: 'rgba(136,191,255,0.92)' };
    } else if (adminLayoutTool === 'door') {
      next = { ...base, type: 'door', x1: pt.x - 18, y1: pt.y + 24, x2: pt.x + 18, y2: pt.y - 24 };
    } else if (adminLayoutTool === 'zone') {
      next = { ...base, type: 'zone', x: pt.x - 80, y: pt.y - 46, w: 160, h: 92, text: adminLayoutDraftText || 'Зона' };
    } else if (adminLayoutTool === 'text') {
      next = { ...base, type: 'text', x: pt.x, y: pt.y, text: adminLayoutDraftText || 'Текст' };
    }
    if (!next) return;
    setAdminLayoutDecor((prev) => [...prev, next]);
    setAdminLayoutSelectedDecorId(next.id);
    setAdminLayoutSelectedId(null);
  }, [adminLayoutDraftText, adminLayoutTool, adminTablesRestaurantId]);

  useEffect(() => {
    return () => {
      const drag = adminLayoutDragRef.current;
      if (drag?.moveHandler) window.removeEventListener('pointermove', drag.moveHandler);
      if (drag?.upHandler) window.removeEventListener('pointerup', drag.upHandler);
      const pan = adminLayoutPanDragRef.current;
      if (pan?.moveHandler) window.removeEventListener('pointermove', pan.moveHandler);
      if (pan?.upHandler) window.removeEventListener('pointerup', pan.upHandler);
      const decor = adminLayoutDecorDragRef.current;
      if (decor?.moveHandler) window.removeEventListener('pointermove', decor.moveHandler);
      if (decor?.upHandler) window.removeEventListener('pointerup', decor.upHandler);
    };
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      setAdminLayoutContextMenu(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Keyboard shortcuts for layout editor
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (tab !== 'tables' || !adminTablesRestaurantId) return;
      
      // Ctrl+Z - Undo (placeholder for future implementation)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        // TODO: Implement undo functionality
        return;
      }
      
      // Delete - Remove selected table or decor
      if (e.key === 'Delete' && !tableEditorBusy) {
        if (adminLayoutSelectedId) {
          const sel = adminTables.find(t => t.id === adminLayoutSelectedId);
          if (sel) {
            deleteTable(sel);
            setAdminLayoutSelectedId(null);
          }
        } else if (adminLayoutSelectedDecorId) {
          setAdminLayoutDecor((prev) => prev.filter((item) => item.id !== adminLayoutSelectedDecorId));
          setAdminLayoutSelectedDecorId(null);
        }
        return;
      }
      
      // R - Rotate selected decoration
      if (e.key === 'r' && !tableEditorBusy && adminLayoutSelectedDecorId) {
        e.preventDefault();
        rotateDecor(adminLayoutSelectedDecorId, e.shiftKey ? -15 : 15);
        return;
      }
      
      // Space - Toggle panorama mode
      if (e.key === ' ' && !tableEditorBusy) {
        e.preventDefault();
        setAdminLayoutTool(prev => prev === 'pan' ? 'select' : 'pan');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tab, adminTablesRestaurantId, adminLayoutSelectedId, adminLayoutSelectedDecorId, tableEditorBusy, deleteTable, rotateDecor]);

  useEffect(() => {
    // reset on restaurant change
    setAdminLayoutZoom(1);
    setAdminLayoutPan({ x: 0, y: 0 });
    setAdminLayoutSelectedDecorId(null);
  }, [adminTablesRestaurantId]);

  useEffect(() => {
    if (!adminTablesRestaurantId) {
      setAdminLayoutDecor([]);
      return;
    }
    try {
      const raw = localStorage.getItem(adminLayoutDecorKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setAdminLayoutDecor(Array.isArray(parsed) ? parsed : []);
    } catch {
      setAdminLayoutDecor([]);
    }
  }, [adminLayoutDecorKey, adminTablesRestaurantId]);

  useEffect(() => {
    if (!adminTablesRestaurantId) return;
    try {
      localStorage.setItem(adminLayoutDecorKey, JSON.stringify(adminLayoutDecor));
    } catch {
      // ignore quota and serialization issues
    }
  }, [adminLayoutDecor, adminLayoutDecorKey, adminTablesRestaurantId]);

  const adminLayoutPlacements = useMemo(() => {
    const placements = adminTables.map((tbl, i) => {
      const c = adminLayoutDisplayFor(tbl, i);
      return { tbl, x: c.x, y: c.y, i };
    });
    for (let pass = 0; pass < 10; pass++) {
      let moved = false;
      for (let ii = 0; ii < placements.length; ii++) {
        const a = placements[ii];
        const barA = String(a.tbl?.kind || '').trim().toLowerCase() === 'bar';
        const scA = Math.max(0.7, Math.min(1.6, Number(a.tbl?.scale) || 1));
        const stA = Math.max(1, Number(a.tbl?.seats || 2));
        const hwA = (barA ? 15 : stA >= 4 ? 32 : 28) * scA;
        const hhA = (barA ? 15 : stA >= 4 ? 20 : 18) * scA;
        for (let jj = ii + 1; jj < placements.length; jj++) {
          const b = placements[jj];
          const barB = String(b.tbl?.kind || '').trim().toLowerCase() === 'bar';
          const scB = Math.max(0.7, Math.min(1.6, Number(b.tbl?.scale) || 1));
          const stB = Math.max(1, Number(b.tbl?.seats || 2));
          const hwB = (barB ? 15 : stB >= 4 ? 32 : 28) * scB;
          const hhB = (barB ? 15 : stB >= 4 ? 20 : 18) * scB;
          const reqX = hwA + hwB + 10;
          const reqY = hhA + hhB + 12;
          const dx = b.x - a.x, dy = b.y - a.y;
          const ovX = reqX - Math.abs(dx), ovY = reqY - Math.abs(dy);
          if (ovX > 0 && ovY > 0) {
            moved = true;
            if (ovX <= ovY) {
              const push = ovX / 2 + 2;
              const dir = dx >= 0 ? 1 : -1;
              a.x -= dir * push; b.x += dir * push;
            } else {
              const push = ovY / 2 + 2;
              const dir = dy >= 0 ? 1 : -1;
              a.y -= dir * push; b.y += dir * push;
            }
          }
        }
      }
      if (!moved) break;
    }
    return placements;
  }, [adminTables, adminLayoutDisplayFor]);

  useEffect(() => {
    if (tab !== 'menu') return;
    loadMenu();
    startCreateMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== 'stoplist' && tab !== 'stats') return;
    loadMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== 'stats' && tab !== 'orders') return;
    loadAdminOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== 'restaurants') return;
    loadAdminRestaurants();
    startCreateRestaurant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== 'events') return;
    loadEvents();
    startCreateEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== 'tables') return;
    if (!adminRestaurants.length) loadAdminRestaurants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab !== 'tables') return;
    if (adminTablesRestaurantId) return;
    if (!adminRestaurants.length) return;
    setAdminTablesRestaurantId(adminRestaurants[0].id);
  }, [adminRestaurants, adminTablesRestaurantId, tab]);

  useEffect(() => {
    if (tab !== 'tables') return;
    if (!adminTablesRestaurantId) return;
    loadAdminTables(adminTablesRestaurantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminTablesRestaurantId, tab]);

  useEffect(() => {
    if (tab !== 'stats' && tab !== 'orders') return;
    const id = setInterval(() => {
      loadAdminOrders();
    }, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="modal-ov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal admin-modal">
        <div className="m-hdr">
          <div className="m-ttl"><span className="ico">⚙</span>{t('admin_title')}</div>
          <button type="button" className="m-x" onClick={onClose} aria-label={t('close')}>
            <Icons.Close />
          </button>
        </div>

        <div className="admin-tabs">
          <button type="button" className={`admin-tab${tab === 'inbox' ? ' on' : ''}`} onClick={() => setTab('inbox')}>
            <Icons.Message /> {t('admin_tab_chats')}
          </button>
          <button type="button" className={`admin-tab${tab === 'menu' ? ' on' : ''}`} onClick={() => setTab('menu')}>
            <Icons.Sliders /> {t('admin_tab_menu')}
          </button>
          <button type="button" className={`admin-tab${tab === 'stoplist' ? ' on' : ''}`} onClick={() => setTab('stoplist')}>
            <Icons.Alert /> {t('admin_tab_stoplist')}
          </button>
          <button type="button" className={`admin-tab${tab === 'stats' ? ' on' : ''}`} onClick={() => setTab('stats')}>
            <Icons.Percent /> {t('admin_tab_stats')}
          </button>
          <button type="button" className={`admin-tab${tab === 'events' ? ' on' : ''}`} onClick={() => setTab('events')}>
            <Icons.Gift /> {t('admin_tab_events')}
          </button>
          <button type="button" className={`admin-tab${tab === 'orders' ? ' on' : ''}`} onClick={() => { setTab('orders'); loadAdminOrders(); }}>
            <Icons.Cart /> Заказы
          </button>
          <button type="button" className={`admin-tab${tab === 'restaurants' ? ' on' : ''}`} onClick={() => setTab('restaurants')}>
            <Icons.Map /> Магазины
          </button>
          <button type="button" className={`admin-tab${tab === 'tables' ? ' on' : ''}`} onClick={() => setTab('tables')}>
            <Icons.Lock /> {t('admin_tab_tables')}
          </button>
          <button type="button" className={`admin-tab${tab === 'reviews' ? ' on' : ''}`} onClick={() => { setTab('reviews'); loadReviews(); }}>
            <Icons.Star /> {t('admin_tab_reviews')}
          </button>
          <button type="button" className={`admin-tab${tab === 'hero' ? ' on' : ''}`} onClick={() => { setTab('hero'); loadHeroMenuItems(); }}>
            <Icons.Image /> {t('admin_hero_tab')}
          </button>
          <button type="button" className={`admin-tab${tab === 'contacts' ? ' on' : ''}`} onClick={() => { setTab('contacts'); loadContactMessages(); }}>
            <Icons.Message /> Сообщения
          </button>
          <button type="button" className={`admin-tab${tab === 'translations' ? ' on' : ''}`} onClick={() => setTab('translations')}>
            <Icons.Globe /> Переводы
          </button>
        </div>

        <div className="admin-body">
          {tab === 'inbox' && (
            <div className="admin-inbox">
              <div className="admin-threadlist">
                <div className="admin-threadlist-h">
                  <div className="admin-threadlist-title">{t('admin_inbox')}</div>
                  <button type="button" className="btn btn-ghost" onClick={loadThreads} disabled={loadingThreads}>
                    <Icons.Refresh /> {t('refresh')}
                  </button>
                </div>
                <div className="admin-threadlist-scroll">
                  {loadingThreads && <div className="admin-muted">{t('loading')}</div>}
                  {!loadingThreads && threads.length === 0 && <div className="admin-muted">{t('admin_no_threads')}</div>}
                  {threads.map((thr) => (
                    <button
                      key={thr.id}
                      type="button"
                      className={`admin-thread${selectedId === thr.id ? ' on' : ''}`}
                      onClick={() => setSelectedId(thr.id)}
                    >
                      <div className="admin-thread-top">
                        <div className="admin-thread-name">
                          {thr.user?.name || t('admin_user_hash', { id: thr.user_id })}
                          {thr.user?.is_pro && <span className="admin-pro"><Icons.Diamond /> PRO</span>}
                        </div>
                        <div className="admin-thread-id">#{thr.id}</div>
                      </div>
                      <div className="admin-thread-sub">
                        {thr.status === 'open' ? t('admin_thread_open') : thr.status === 'closed' ? t('admin_thread_closed') : thr.status}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="admin-chat">
                {!selectedThread ? (
                  <div className="admin-muted">{t('admin_pick_thread')}</div>
                ) : (
                  <>
                    <div className="admin-chat-h">
                      <div>
                        <div className="admin-chat-title">{selectedThread.user?.name || t('admin_user_hash', { id: selectedThread.user_id })}</div>
                        <div className="admin-chat-sub">{t('admin_chat_hash', { id: selectedThread.id })}</div>
                      </div>
                      <div className="admin-chat-badges">
                        {selectedThread.user?.is_pro && <span className="admin-badge"><Icons.Diamond /> VIP</span>}
                      </div>
                    </div>

                    <div className="admin-chat-list" ref={listRef}>
                      {loadingMessages && <div className="admin-muted">{t('admin_loading_messages')}</div>}
                      {!loadingMessages && messages.length === 0 && <div className="admin-muted">{t('admin_no_messages')}</div>}
                      {messages.map((m) => (
                        <div key={m.id} className={`admin-msg ${m.sender_role === 'admin' ? 'admin' : m.sender_role === 'assistant' ? 'assistant' : 'user'}`}>
                          <div className="admin-bubble">
                            {m.sender_role === 'assistant' && <span className="admin-ai">AI</span>}
                            {m.text}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="admin-chat-foot">
                      <input
                        className="fi admin-inp"
                        type="text"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={t('admin_reply_ph')}
                        onKeyDown={(e) => e.key === 'Enter' && send()}
                        disabled={loadingMessages}
                      />
                      <button type="button" className="admin-ai-btn" onClick={aiReply} disabled={loadingMessages} aria-label={t('admin_ai_reply')} title={t('admin_ai_reply')}>
                        <Icons.Sparkles />
                      </button>
                      <button type="button" className="admin-send" onClick={send} disabled={loadingMessages || !draft.trim()} aria-label={t('admin_send_message')} title={t('admin_send_message')}>
                        <Icons.Send />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'orders' && (
            <div className="admin-panel" style={{ maxWidth: '100%' }}>
              <div className="admin-panel-h">
                <div>
                  <div className="admin-panel-title">Заказы</div>
                  <div className="admin-muted">Управление статусами — обновления видны клиенту в реальном времени</div>
                </div>
                <button type="button" className="btn btn-ghost" onClick={loadAdminOrders} disabled={adminOrdersLoading}>
                  <Icons.Refresh /> {t('refresh')}
                </button>
              </div>
              <div className="admin-panel-scroll">
                {adminOrdersLoading && <div className="admin-muted">{t('loading')}</div>}
                {!adminOrdersLoading && adminOrders.length === 0 && <div className="admin-muted">Заказов пока нет.</div>}
                {adminOrders.map((order) => {
                  const rest = restaurantById.get(order?.restaurant_id)?.address || (order?.restaurant_id ? `Магазин #${order.restaurant_id}` : 'Не указан');
                  const items = Array.isArray(order?.items) ? order.items : [];
                  const currentStatus = order.status || localOrderStatuses[String(order.id)] || 'pending';
                  const currentIdx = ORDER_STATUS_FLOW.indexOf(currentStatus);
                  return (
                    <div key={order.id} className="admin-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div className="admin-row-main" style={{ flex: 1 }}>
                          <div className="admin-row-name" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            Заказ #{order.id}
                            <span className={`admin-status ${order?.fulfillment === 'pickup' ? 'wait' : 'ok'}`}>
                              {order?.fulfillment === 'pickup' ? 'Самовывоз' : 'Доставка'}
                            </span>
                            <span className={`admin-status ${ORDER_STATUS_CLS[currentStatus] || 'wait'}`}>
                              {ORDER_STATUS_LABELS[currentStatus] || currentStatus}
                            </span>
                          </div>
                          <div className="admin-row-sub">
                            {order?.created_at ? new Date(order.created_at).toLocaleString() : 'Без даты'} · {rest}
                          </div>
                          <div className="admin-row-sub">
                            {order?.fulfillment_time ? `На ${order.fulfillment_time}` : ''} · {order?.payment || ''} · {order?.total || 0} ₽
                          </div>
                          {order?.address && <div className="admin-row-sub">📍 {order.address}</div>}
                          {order?.comment && <div className="admin-row-sub">💬 {order.comment}</div>}
                          <div className="admin-order-items" style={{ marginTop: 6 }}>
                            {items.length === 0 && <span className="admin-order-chip">Без состава</span>}
                            {items.map((item, idx) => (
                              <span key={`${order.id}-${item?.id || idx}`} className="admin-order-chip">
                                {item?.name || `Позиция #${idx + 1}`} ×{item?.qty || item?.quantity || 1}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      {/* Status stepper */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {ORDER_STATUS_FLOW.map((s, i) => (
                          <button
                            key={s}
                            type="button"
                            className={`btn ${i === currentIdx ? 'btn-gold' : i < currentIdx ? 'btn-ghost' : 'btn-ghost'}`}
                            style={{
                              fontSize: 10, padding: '5px 10px', letterSpacing: 1,
                              opacity: i < currentIdx ? 0.45 : 1,
                            }}
                            onClick={async () => {
                              try {
                                await api.admin.orders.updateStatus(adminId, order.id, s);
                                setOrderStatus(order.id, s);
                                setLocalOrderStatuses(getAllOrderStatuses());
                                await loadAdminOrders();
                              } catch (e) {
                                toast?.err?.(e.message || t('admin_saved'));
                              }
                            }}
                          >
                            {i < currentIdx ? '✓' : ''} {ORDER_STATUS_LABELS[s]}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="btn btn-outline-gold"
                          style={{ fontSize: 10, padding: '5px 10px', letterSpacing: 1 }}
                          onClick={async () => {
                            try {
                              await api.admin.orders.updateStatus(adminId, order.id, 'cancelled');
                              setOrderStatus(order.id, 'cancelled');
                              setLocalOrderStatuses(getAllOrderStatuses());
                              await loadAdminOrders();
                            } catch (e) {
                              toast?.err?.(e.message || t('admin_saved'));
                            }
                          }}
                        >
                          Отменить
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'restaurants' && (
            <div className="admin-split">
              <div className="admin-panel">
                <div className="admin-panel-h">
                  <div className="admin-panel-title">Адреса магазинов</div>
                  <button type="button" className="btn btn-ghost" onClick={loadAdminRestaurants} disabled={adminRestaurantsLoading || restaurantBusy}>
                    <Icons.Refresh /> {t('refresh')}
                  </button>
                </div>
                <div className="admin-panel-scroll">
                  {adminRestaurantsLoading && <div className="admin-muted">{t('loading')}</div>}
                  {!adminRestaurantsLoading && adminRestaurants.length === 0 && <div className="admin-muted">Магазинов пока нет.</div>}
                  {adminRestaurants.map((item) => (
                    <div key={item.id} className="admin-row">
                      <div className="admin-row-main">
                        <div className="admin-row-name">{item.name || `Магазин #${item.id}`}</div>
                        <div className="admin-row-sub">{item.address || 'Адрес не указан'}</div>
                        <div className="admin-row-sub">{item.phone || 'Телефон не указан'}</div>
                      </div>
                      <div className="admin-row-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => startEditRestaurant(item)} disabled={restaurantBusy}>Изменить</button>
                        <button type="button" className="btn btn-outline-gold" onClick={() => deleteRestaurant(item)} disabled={restaurantBusy}>Удалить</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-panel">
                <div className="admin-panel-h">
                  <div className="admin-panel-title">{restaurantEditingId ? `Редактирование #${restaurantEditingId}` : 'Новый магазин'}</div>
                  <button type="button" className="btn btn-ghost" onClick={startCreateRestaurant} disabled={restaurantBusy}>{t('admin_clear')}</button>
                </div>
                <div className="admin-form">
                  <div className="fg">
                    <div className="fl">Название</div>
                    <input className="fi" type="text" value={restaurantForm.name} onChange={(e) => setRestaurantForm((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="fg">
                    <div className="fl">Адрес</div>
                    <input className="fi" type="text" value={restaurantForm.address} onChange={(e) => setRestaurantForm((p) => ({ ...p, address: e.target.value }))} />
                  </div>
                  <div className="fg">
                    <div className="fl">Телефон</div>
                    <input className="fi" type="text" value={restaurantForm.phone} onChange={(e) => setRestaurantForm((p) => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <button type="button" className="btn btn-gold" onClick={saveRestaurant} disabled={restaurantBusy}>
                    <Icons.Sparkles /> {restaurantBusy ? 'Сохраняю…' : 'Сохранить магазин'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'tables' && (
            <div className="admin-split">
              <div className="admin-panel">
                <div className="admin-panel-h">
                  <div className="admin-panel-title">{t('admin_tab_tables')}</div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => (adminTablesRestaurantId ? loadAdminTables(adminTablesRestaurantId) : loadAdminRestaurants())}
                    disabled={adminTablesLoading || adminRestaurantsLoading}
                  >
                    <Icons.Refresh /> {t('refresh')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-gold"
                    onClick={() => openCreateTable()}
                    disabled={!adminTablesRestaurantId || tableEditorBusy}
                    title={!adminTablesRestaurantId ? t('admin_pick_restaurant') : undefined}
                  >
                    + {t('admin_table_add')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={deleteAllTablesForRestaurant}
                    disabled={!adminTablesRestaurantId || tableEditorBusy || adminTablesLoading}
                    title={t('admin_table_delete_all')}
                  >
                    <Icons.Trash /> {t('admin_table_delete_all')}
                  </button>
                </div>
                <div className="admin-panel-scroll">
                  <div className="fg" style={{ marginBottom: 10 }}>
                    <div className="fl"><Icons.Map /> {t('admin_restaurant')}</div>
                    <select
                      className="fi"
                      value={adminTablesRestaurantId || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAdminTablesRestaurantId(v ? Number(v) : null);
                      }}
                      disabled={adminRestaurantsLoading}
                    >
                      <option value="">{t('admin_pick_restaurant')}</option>
                      {adminRestaurants.map((r) => (
                        <option key={r.id} value={r.id}>{r.address}</option>
                      ))}
                    </select>
                  </div>

                  {adminRestaurantsLoading && <div className="admin-muted">{t('admin_loading_restaurants')}</div>}
                  {!adminRestaurantsLoading && adminTablesRestaurantId && adminTablesLoading && <div className="admin-muted">{t('admin_loading_tables')}</div>}

                  {!adminTablesLoading && adminTablesRestaurantId && adminTables.length === 0 && (
                    <div className="admin-muted">{t('admin_no_tables_for_restaurant')}</div>
                  )}

                  {!adminTablesLoading && adminTablesRestaurantId && adminTables.length > 0 && (
                    <>
                      <div className="admin-stub" style={{ marginBottom: 12 }}>
                        <div className="admin-stub-h">{t('admin_tables_manage')}</div>
                        <div className="admin-muted">{t('admin_blocking_help')}</div>
                      </div>

                      {tableEditor && (
                        <div className="admin-stub" style={{ marginBottom: 12 }}>
                          <div className="admin-stub-h">
                            {tableEditor.mode === 'create' ? t('admin_table_add') : t('admin_table_edit')}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 10, marginTop: 10 }}>
                            <div className="fg" style={{ marginBottom: 0 }}>
                              <div className="fl">{t('admin_table_name')}</div>
                              <input
                                className="fi"
                                type="text"
                                value={tableEditor.name}
                                onChange={(e) => setTableEditor((p) => ({ ...p, name: e.target.value }))}
                                disabled={tableEditorBusy}
                              />
                            </div>
                            <div className="fg" style={{ marginBottom: 0 }}>
                              <div className="fl">{t('admin_table_seats')}</div>
                              <select
                                className="fi"
                                value={tableEditor.seats}
                                onChange={(e) => setTableEditor((p) => ({ ...p, seats: Number(e.target.value) }))}
                                disabled={tableEditorBusy}
                              >
                                {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 10 }}>
                            <div className="fg" style={{ marginBottom: 0 }}>
                              <div className="fl">{t('admin_table_type')}</div>
                              <select
                                className="fi"
                                value={tableEditor.kind}
                                onChange={(e) => setTableEditor((p) => ({ ...p, kind: e.target.value }))}
                                disabled={tableEditorBusy}
                              >
                                <option value="standard">{t('admin_table_type_standard')}</option>
                                <option value="round">{t('admin_table_type_round')}</option>
                                <option value="booth">{t('admin_table_type_booth')}</option>
                                <option value="bar">{t('admin_table_type_bar')}</option>
                              </select>
                            </div>
                            <div className="fg" style={{ marginBottom: 0 }}>
                              <div className="fl">{t('admin_table_size')}</div>
                              <input
                                className="fi"
                                type="number"
                                min="0.7"
                                max="1.6"
                                step="0.05"
                                value={tableEditor.scale}
                                onChange={(e) => setTableEditor((p) => ({ ...p, scale: Number(e.target.value) }))}
                                disabled={tableEditorBusy}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                            <button type="button" className="btn btn-ghost" onClick={() => openCreateTable({ seats: 2, kind: 'standard' })} disabled={tableEditorBusy}>
                              +2
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={() => openCreateTable({ seats: 4, kind: 'standard' })} disabled={tableEditorBusy}>
                              +4
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={() => openCreateTable({ seats: 4, kind: 'round' })} disabled={tableEditorBusy}>
                              {t('admin_table_type_round')}
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={() => openCreateTable({ seats: 4, kind: 'booth' })} disabled={tableEditorBusy}>
                              {t('admin_table_type_booth')}
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={() => openCreateTable({ seats: 2, kind: 'bar', scale: 0.9 })} disabled={tableEditorBusy}>
                              {t('admin_table_type_bar')}
                            </button>
                            <div style={{ flex: 1 }} />
                            <button type="button" className="btn btn-outline-gold" onClick={saveTableEditor} disabled={tableEditorBusy || !String(tableEditor.name || '').trim()}>
                              {t('admin_save')}
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={() => setTableEditor(null)} disabled={tableEditorBusy}>
                              {t('close')}
                            </button>
                            {tableEditor.mode === 'edit' && (
                              <button type="button" className="btn btn-ghost" onClick={() => deleteTable({ id: tableEditor.id })} disabled={tableEditorBusy}>
                                <Icons.Trash /> {t('admin_table_delete')}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="admin-table-grid">
                        {adminTables.map((tbl) => {
                          const busy = adminTableUpdatingId === tbl.id;
                          const statusClass = tbl.is_blocked ? 'bad' : 'ok';
                          const statusText = tbl.is_blocked ? t('admin_table_status_blocked') : t('admin_table_status_available');
                          const num = String(tbl?.name || '').match(/(\d+)/);
                          const title = num ? t('admin_table_number', { n: num[1] }) : (tbl?.name || `#${tbl.id}`);
                          return (
                            <div key={tbl.id} style={{ position: 'relative' }}>
                              <button
                                type="button"
                                className={`admin-table-card${tbl.is_blocked ? ' blocked' : ''}`}
                                onClick={() => toggleTableBlocked(tbl)}
                                disabled={busy}
                                title={t('admin_table_toggle_hint')}
                                style={{ width: '100%' }}
                              >
                                <div className="admin-table-top">
                                  <div className="admin-table-title">{title}</div>
                                  <span className={`admin-status-dot ${statusClass}`} title={statusText} aria-label={statusText} />
                                </div>
                                <div className="admin-table-sub">{t('seats', { count: tbl.seats })} · {t('admin_id')}: {tbl.id}</div>
                              </button>
                              <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  className="ico-btn"
                                  onClick={(e) => { e.stopPropagation(); openEditTable(tbl); }}
                                  title={t('admin_table_edit')}
                                  aria-label={t('admin_table_edit')}
                                >
                                  <Icons.Edit />
                                </button>
                                <button
                                  type="button"
                                  className="ico-btn"
                                  onClick={(e) => { e.stopPropagation(); deleteTable(tbl); }}
                                  title={t('admin_table_delete')}
                                  aria-label={t('admin_table_delete')}
                                >
                                  <Icons.Trash />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="admin-stub">
                <div className="admin-stub-h">{t('admin_layout_title')}</div>
                <div className="admin-muted">{t('admin_layout_help')}</div>

                {!adminTablesRestaurantId && (
                  <div className="admin-muted" style={{ marginTop: 12 }}>
                    {t('admin_pick_restaurant')}
                  </div>
                )}

                {adminTablesRestaurantId && !adminTablesLoading && (
                  <div style={{ marginTop: 12 }}>
                    {/* Improved Toolbar with Logical Blocks */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                      {/* Block 1: Добавить столы */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>Добавить</span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {[
                            { seats: 2, kind: 'standard', icon: '▢', title: '2 места' },
                            { seats: 4, kind: 'standard', icon: '▭', title: '4 места' },
                            { seats: 4, kind: 'round', icon: '●', title: 'Круглый' },
                            { seats: 4, kind: 'booth', icon: '⊞', title: 'Кабинка' },
                            { seats: 2, kind: 'bar', scale: 0.9, icon: '—', title: 'Барная стойка' },
                          ].map((preset) => (
                            <button
                              key={`${preset.kind}-${preset.seats}`}
                              type="button"
                              className="btn btn-ghost"
                              style={{
                                fontSize: 14,
                                padding: '6px 8px',
                                minWidth: 0,
                                border: '1.5px solid rgba(201,169,110,0.40)',
                                background: 'rgba(201,169,110,0.06)',
                                color: 'var(--gold)',
                              }}
                              onClick={() => quickAddTable(preset)}
                              disabled={tableEditorBusy}
                              title={preset.title}
                            >
                              {preset.icon}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Block 2: Режим */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>Режим</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {[
                            ['pan', '🖱'],
                            ['select', '▢'],
                          ].map(([toolId, icon]) => (
                            <button
                              key={toolId}
                              type="button"
                              className={`btn ${adminLayoutTool === toolId ? 'btn-gold' : 'btn-ghost'}`}
                              style={{ fontSize: 12, padding: '6px 10px', minWidth: 0 }}
                              onClick={() => setAdminLayoutTool(toolId)}
                              disabled={tableEditorBusy}
                              title={toolId === 'pan' ? 'Панорама (Space)' : 'Выбор'}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Block 3: Конструктор */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>Конструктор</span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {[
                            ['wall', '|'],
                            ['door', '🚪'],
                            ['window', '▭'],
                            ['zone', '⊕'],
                            ['text', 'Т'],
                          ].map(([toolId, icon]) => (
                            <button
                              key={toolId}
                              type="button"
                              className={adminLayoutTool === toolId ? 'btn btn-gold' : 'btn btn-ghost'}
                              style={{ fontSize: 11, padding: '6px 10px', minWidth: 0 }}
                              onClick={() => setAdminLayoutTool(toolId)}
                              disabled={tableEditorBusy}
                              title={toolId}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                        {(adminLayoutTool === 'zone' || adminLayoutTool === 'text') && (
                          <input
                            className="fi"
                            type="text"
                            value={adminLayoutDraftText}
                            onChange={(e) => setAdminLayoutDraftText(e.target.value)}
                            placeholder="Подпись"
                            disabled={tableEditorBusy}
                            style={{ fontSize: 11, padding: '6px 8px', width: 120, marginLeft: 8 }}
                          />
                        )}
                      </div>

                      {/* Actions row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {adminLayoutSelectedDecorId && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ fontSize: 11, padding: '6px 10px', color: 'rgba(220,80,70,0.9)' }}
                            onClick={() => {
                              setAdminLayoutDecor((prev) => prev.filter((item) => item.id !== adminLayoutSelectedDecorId));
                              setAdminLayoutSelectedDecorId(null);
                            }}
                            disabled={tableEditorBusy}
                          >
                            🗑 Удалить объект
                          </button>
                        )}
                        {adminLayoutDecor.length > 0 && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ fontSize: 11, padding: '6px 10px', color: 'rgba(220,80,70,0.8)' }}
                            onClick={deleteAllDecor}
                            disabled={tableEditorBusy}
                            title={`Удалить все ${adminLayoutDecor.length} элементов конструктора`}
                          >
                            🗑 Очистить всё ({adminLayoutDecor.length})
                          </button>
                        )}
                        {adminLayoutSelectedId && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ fontSize: 11, padding: '6px 10px', color: 'rgba(220,80,70,0.9)' }}
                            onClick={() => {
                              const sel = adminTables.find(t => t.id === adminLayoutSelectedId);
                              if (sel) deleteTable(sel);
                              setAdminLayoutSelectedId(null);
                            }}
                            disabled={tableEditorBusy}
                          >
                            ✕ {t('admin_table_delete')}
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ width: '100%', maxWidth: 1040, background: 'linear-gradient(180deg,#141414,#0a0a0a)', borderRadius: 10, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)', position: 'relative' }}
                      onClick={() => { setAdminLayoutSelectedId(null); setAdminLayoutSelectedDecorId(null); }}
                    >
                      <svg
                        ref={adminLayoutSvgRef}
                        viewBox={adminLayoutViewBox.str}
                        preserveAspectRatio="xMidYMid meet"
                        style={{ display: 'block', width: '100%', height: 'auto', touchAction: 'none' }}
                        onPointerDown={(e) => {
                          if (tableEditorBusy) return;
                          if (e.button != null && e.button !== 0) return;
                          const pt = adminLayoutClientToSvg(e.clientX, e.clientY);
                          if (!pt) return;
                          if (adminLayoutTool !== 'pan') {
                            e.preventDefault();
                            e.stopPropagation();
                            if (adminLayoutTool !== 'select') addDecorAtPoint(pt);
                            return;
                          }
                          e.preventDefault();
                          e.stopPropagation();

                          const zoom = adminLayoutViewBox.z;
                          const startPt = pt;
                          const startPan = { x: adminLayoutViewBox.x, y: adminLayoutViewBox.y };

                          const moveHandler = (ev) => {
                            const p = adminLayoutClientToSvg(ev.clientX, ev.clientY);
                            if (!p) return;
                            const dx = p.x - startPt.x;
                            const dy = p.y - startPt.y;
                            setAdminLayoutPan(adminLayoutClampPan({ x: startPan.x - dx, y: startPan.y - dy }, zoom));
                          };

                          const upHandler = () => {
                            const pan = adminLayoutPanDragRef.current;
                            adminLayoutPanDragRef.current = null;
                            if (pan?.moveHandler) window.removeEventListener('pointermove', pan.moveHandler);
                            if (pan?.upHandler) window.removeEventListener('pointerup', pan.upHandler);
                          };

                          adminLayoutPanDragRef.current = { moveHandler, upHandler };
                          window.addEventListener('pointermove', moveHandler);
                          window.addEventListener('pointerup', upHandler);
                        }}
                        onWheel={(e) => {
                          if (!e.ctrlKey && !e.metaKey) return;
                          if (tableEditorBusy) return;
                          const pt = adminLayoutClientToSvg(e.clientX, e.clientY);
                          if (!pt) return;
                          e.preventDefault();
                          const factor = Math.exp((-Number(e.deltaY) || 0) / 250);
                          adminLayoutZoomAt(pt, adminLayoutZoom * factor);
                        }}
                      >
                        <defs>
                          <linearGradient id="adm-floor" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stopColor="rgba(255,255,255,0.06)" />
                            <stop offset="1" stopColor="rgba(201,169,110,0.04)" />
                          </linearGradient>
                          <filter id="adm-shadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.28"/>
                          </filter>
                          <filter id="adm-glow" x="-60%" y="-60%" width="220%" height="220%">
                            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="rgba(201,169,110,0.6)" floodOpacity="1" />
                          </filter>
                        </defs>
                        <rect x="0" y="0" width={ADMIN_LAYOUT_W} height={ADMIN_LAYOUT_H} fill="rgba(0,0,0,0.16)" />
                        {Array.from({ length: 24 }).map((_, idx) => (
                          <line key={`grid-v-${idx}`} x1={idx * 40} y1="0" x2={idx * 40} y2={ADMIN_LAYOUT_H} stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
                        ))}
                        {Array.from({ length: 16 }).map((_, idx) => (
                          <line key={`grid-h-${idx}`} x1="0" y1={idx * 40} x2={ADMIN_LAYOUT_W} y2={idx * 40} stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
                        ))}
                        <rect x={10 * ADMIN_LAYOUT_SCALE} y={10 * ADMIN_LAYOUT_SCALE} width={460 * ADMIN_LAYOUT_SCALE} height={300 * ADMIN_LAYOUT_SCALE} rx={18 * ADMIN_LAYOUT_SCALE} fill="url(#adm-floor)" stroke="rgba(255,255,255,0.07)" />
                        
                        {/* ВХОД text with background */}
                        <rect x={20 * ADMIN_LAYOUT_SCALE} y={36 * ADMIN_LAYOUT_SCALE} width={58 * ADMIN_LAYOUT_SCALE} height={20 * ADMIN_LAYOUT_SCALE} rx={4 * ADMIN_LAYOUT_SCALE} fill="rgba(201,169,110,0.15)" stroke="rgba(201,169,110,0.35)" strokeWidth="1" />
                        <text x={28 * ADMIN_LAYOUT_SCALE} y={48 * ADMIN_LAYOUT_SCALE} fill="rgba(201,169,110,0.85)" fontSize="11" fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Arial" fontWeight="600" letterSpacing="2">ВХОД</text>
                        
                        {/* ОКНА text with background */}
                        <rect x={380 * ADMIN_LAYOUT_SCALE} y={36 * ADMIN_LAYOUT_SCALE} width={52 * ADMIN_LAYOUT_SCALE} height={18 * ADMIN_LAYOUT_SCALE} rx={4 * ADMIN_LAYOUT_SCALE} fill="rgba(136,191,255,0.12)" stroke="rgba(136,191,255,0.30)" strokeWidth="1" />
                        <text x={388 * ADMIN_LAYOUT_SCALE} y={48 * ADMIN_LAYOUT_SCALE} fill="rgba(136,191,255,0.80)" fontSize="10" fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Arial" fontWeight="600" letterSpacing="2">ОКНА</text>
                        
                        {/* КУХНЯ text with background */}
                        <rect x={364 * ADMIN_LAYOUT_SCALE} y={224 * ADMIN_LAYOUT_SCALE} width={60 * ADMIN_LAYOUT_SCALE} height={18 * ADMIN_LAYOUT_SCALE} rx={4 * ADMIN_LAYOUT_SCALE} fill="rgba(192,110,100,0.12)" stroke="rgba(192,110,100,0.30)" strokeWidth="1" />
                        <text x={372 * ADMIN_LAYOUT_SCALE} y={236 * ADMIN_LAYOUT_SCALE} fill="rgba(192,110,100,0.80)" fontSize="10" fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Arial" fontWeight="600" letterSpacing="2">КУХНЯ</text>
                        
                        <rect x={18 * ADMIN_LAYOUT_SCALE} y={238 * ADMIN_LAYOUT_SCALE} width={444 * ADMIN_LAYOUT_SCALE} height={64 * ADMIN_LAYOUT_SCALE} rx={16 * ADMIN_LAYOUT_SCALE} fill="rgba(0,0,0,0.20)" stroke="rgba(255,255,255,0.06)" />
                        <text x={32 * ADMIN_LAYOUT_SCALE} y={265 * ADMIN_LAYOUT_SCALE} fill="rgba(242,237,230,0.38)" fontSize="10" fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Arial" letterSpacing="2">BAR</text>

                        {adminLayoutDecor.map((item) => {
                          const selectedDecor = adminLayoutSelectedDecorId === item.id;
                          const startDecorDrag = (e) => {
                            if (adminLayoutTool !== 'select') return;
                            const pt = adminLayoutClientToSvg(e.clientX, e.clientY);
                            if (!pt) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setAdminLayoutSelectedDecorId(item.id);
                            setAdminLayoutSelectedId(null);
                            const moveHandler = (ev) => {
                              const nextPt = adminLayoutClientToSvg(ev.clientX, ev.clientY);
                              const drag = adminLayoutDecorDragRef.current;
                              if (!nextPt || !drag) return;
                              const dx = nextPt.x - drag.start.x;
                              const dy = nextPt.y - drag.start.y;
                              setAdminLayoutDecor((prev) => prev.map((entry) => (
                                entry.id === drag.id ? moveDecorBy(drag.base, dx, dy) : entry
                              )));
                            };
                            const upHandler = () => {
                              const drag = adminLayoutDecorDragRef.current;
                              adminLayoutDecorDragRef.current = null;
                              if (drag?.moveHandler) window.removeEventListener('pointermove', drag.moveHandler);
                              if (drag?.upHandler) window.removeEventListener('pointerup', drag.upHandler);
                            };
                            adminLayoutDecorDragRef.current = { id: item.id, base: item, start: pt, moveHandler, upHandler };
                            window.addEventListener('pointermove', moveHandler);
                            window.addEventListener('pointerup', upHandler);
                          };

                          if (item.type === 'wall') {
                            const centerX = (item.x1 + item.x2) / 2;
                            const centerY = (item.y1 + item.y2) / 2;
                            const rotation = Number(item.rotation || 0);
                            return (
                              <line
                                key={item.id}
                                x1={item.x1}
                                y1={item.y1}
                                x2={item.x2}
                                y2={item.y2}
                                stroke={selectedDecor ? 'rgba(255,255,255,0.98)' : (item.color || 'rgba(201,169,110,0.88)')}
                                strokeWidth={selectedDecor ? 10 : 8}
                                strokeLinecap="round"
                                onPointerDown={startDecorDrag}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setAdminLayoutSelectedDecorId(item.id);
                                  setAdminLayoutContextMenu({
                                    decorId: item.id,
                                    x: e.clientX,
                                    y: e.clientY,
                                  });
                                }}
                                style={{
                                  cursor: adminLayoutTool === 'select' ? 'move' : 'default',
                                  transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
                                  transformOrigin: `${centerX}px ${centerY}px`,
                                }}
                              />
                            );
                          }
                          if (item.type === 'window') {
                            const rotation = Number(item.rotation || 0);
                            const centerX = (item.x1 + item.x2) / 2;
                            const centerY = (item.y1 + item.y2) / 2;
                            return (
                              <line
                                key={item.id}
                                x1={item.x1}
                                y1={item.y1}
                                x2={item.x2}
                                y2={item.y2}
                                stroke={selectedDecor ? '#ffffff' : (item.color || 'rgba(136,191,255,0.92)')}
                                strokeWidth={selectedDecor ? 8 : 6}
                                strokeLinecap="round"
                                strokeDasharray="10 8"
                                onPointerDown={startDecorDrag}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setAdminLayoutSelectedDecorId(item.id);
                                  setAdminLayoutContextMenu({
                                    decorId: item.id,
                                    x: e.clientX,
                                    y: e.clientY,
                                  });
                                }}
                                style={{
                                  cursor: adminLayoutTool === 'select' ? 'move' : 'default',
                                  transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
                                  transformOrigin: `${centerX}px ${centerY}px`,
                                }}
                              />
                            );
                          }
                          if (item.type === 'door') {
                            const r = Math.hypot((item.x2 - item.x1), (item.y2 - item.y1));
                            const rotation = Number(item.rotation || 0);
                            const centerX = (item.x1 + item.x2) / 2;
                            const centerY = (item.y1 + item.y2) / 2;
                            return (
                              <g 
                                key={item.id} 
                                onPointerDown={startDecorDrag}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setAdminLayoutSelectedDecorId(item.id);
                                  setAdminLayoutContextMenu({
                                    decorId: item.id,
                                    x: e.clientX,
                                    y: e.clientY,
                                  });
                                }}
                                style={{
                                  cursor: adminLayoutTool === 'select' ? 'move' : 'default',
                                  transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
                                  transformOrigin: `${centerX}px ${centerY}px`,
                                }}
                              >
                                <line x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} stroke={selectedDecor ? '#fff' : 'rgba(201,169,110,0.88)'} strokeWidth={selectedDecor ? 5 : 4} strokeLinecap="round" />
                                <path d={`M ${item.x1} ${item.y1} A ${r} ${r} 0 0 1 ${item.x2} ${item.y2}`} fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="2" />
                              </g>
                            );
                          }
                          if (item.type === 'zone') {
                            const rotation = Number(item.rotation || 0);
                            const centerX = item.x + item.w / 2;
                            const centerY = item.y + item.h / 2;
                            return (
                              <g 
                                key={item.id} 
                                onPointerDown={startDecorDrag}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setAdminLayoutSelectedDecorId(item.id);
                                  setAdminLayoutContextMenu({
                                    decorId: item.id,
                                    x: e.clientX,
                                    y: e.clientY,
                                  });
                                }}
                                style={{
                                  cursor: adminLayoutTool === 'select' ? 'move' : 'default',
                                  transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
                                  transformOrigin: `${centerX}px ${centerY}px`,
                                }}
                              >
                                <rect x={item.x} y={item.y} width={item.w} height={item.h} rx="16" fill="rgba(201,169,110,0.08)" stroke={selectedDecor ? '#fff' : 'rgba(201,169,110,0.42)'} strokeWidth={selectedDecor ? 3 : 2} strokeDasharray="10 6" />
                                <text x={item.x + (item.w / 2)} y={item.y + (item.h / 2)} textAnchor="middle" fill="rgba(242,237,230,0.88)" fontSize="16" fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Arial">{item.text || 'Зона'}</text>
                              </g>
                            );
                          }
                          if (item.type === 'text') {
                            const rotation = Number(item.rotation || 0);
                            return (
                              <text
                                key={item.id}
                                x={item.x}
                                y={item.y}
                                textAnchor="middle"
                                fill={selectedDecor ? '#ffffff' : 'rgba(242,237,230,0.76)'}
                                fontSize="18"
                                fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Arial"
                                onPointerDown={startDecorDrag}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setAdminLayoutSelectedDecorId(item.id);
                                  setAdminLayoutContextMenu({
                                    decorId: item.id,
                                    x: e.clientX,
                                    y: e.clientY,
                                  });
                                }}
                                style={{
                                  cursor: adminLayoutTool === 'select' ? 'move' : 'default',
                                  userSelect: 'none',
                                  transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined,
                                  transformOrigin: `${item.x}px ${item.y}px`,
                                }}
                              >
                                {item.text || 'Текст'}
                              </text>
                            );
                          }
                          return null;
                        })}

                        {adminLayoutPlacements.map(({ tbl, x, y, i }) => {
                          const isBlocked = Boolean(tbl?.is_blocked);
                          const num = String(tbl?.name || '').match(/(\d+)/);
                          const label = num ? String(num[1]) : String(tbl?.id || '');
                          const kind = String(tbl?.kind || '').trim().toLowerCase() || 'standard';
                          const scale = Math.max(0.7, Math.min(1.6, Number(tbl?.scale) || 1));
                          const seats = Math.max(1, Number(tbl?.seats || 2));
                          const bar = kind === 'bar';
                          const round = kind === 'round';
                          const booth = kind === 'booth';
                          const w = (bar ? 30 : seats >= 4 ? 64 : 56) * scale;
                          const h = (bar ? 30 : seats >= 4 ? 40 : 36) * scale;
                          const busy = adminLayoutDraggingId === tbl.id;
                          const selected = adminLayoutSelectedId === tbl.id;
                          const floor = { x: 10 * ADMIN_LAYOUT_SCALE, y: 10 * ADMIN_LAYOUT_SCALE, w: 460 * ADMIN_LAYOUT_SCALE, h: 300 * ADMIN_LAYOUT_SCALE };
                          const mX = w / 2 + 14;
                          const mY = h / 2 + 14;
                          const clampVal = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
                          const cx = clampVal(x, floor.x + mX, floor.x + floor.w - mX);
                          const cy = clampVal(y, floor.y + mY, floor.y + floor.h - mY);
                          return (
                            <g
                              key={tbl.id}
                              transform={`translate(${cx}, ${cy})`}
                              filter={selected ? 'url(#adm-glow)' : 'url(#adm-shadow)'}
                              style={{ cursor: 'grab', opacity: isBlocked ? 0.55 : 1 }}
                              onClick={(e) => { e.stopPropagation(); }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setAdminLayoutSelectedId(tbl.id);
                                setAdminLayoutContextMenu({
                                  tableId: tbl.id,
                                  x: e.clientX,
                                  y: e.clientY,
                                });
                              }}
                              onPointerDown={(e) => {
                                if (!adminId || !tbl?.id) return;
                                if (adminLayoutTool !== 'pan' && adminLayoutTool !== 'select') return;
                                e.preventDefault();
                                e.stopPropagation();
                                setAdminLayoutSelectedDecorId(null);

                                const pt = adminLayoutClientToSvg(e.clientX, e.clientY);
                                if (!pt) return;

                                const params = adminLayoutParams;
                                const rawFromDisplay = (displayX, displayY) => {
                                  const s = ADMIN_LAYOUT_SCALE;
                                  const dx0 = displayX / s;
                                  const dy0 = displayY / s;
                                  const { baseCx, baseCy, sin, cos, shiftX, shiftY } = params;
                                  const cx2 = 240;
                                  const cy2 = 160;
                                  const gapScaleX = 1.28;
                                  const gapScaleY = 1.38;
                                  const x1 = dx0 - shiftX;
                                  const y1 = dy0 - shiftY;
                                  const dx1 = x1 - baseCx;
                                  const dy1 = y1 - baseCy;
                                  const dx = dx1 * cos + dy1 * sin;
                                  const dy = -dx1 * sin + dy1 * cos;
                                  const xScaled = baseCx + dx;
                                  const yScaled = baseCy + dy;
                                  const rawX = (xScaled - cx2) / gapScaleX + cx2;
                                  const rawY = (yScaled - cy2) / gapScaleY + cy2;
                                  return { x: Math.round(rawX), y: Math.round(rawY) };
                                };

                                const prevX = Number.isFinite(Number(tbl.x)) ? Number(tbl.x) : rawFromDisplay(cx, cy).x;
                                const prevY = Number.isFinite(Number(tbl.y)) ? Number(tbl.y) : rawFromDisplay(cx, cy).y;

                                const flr = { x: 10 * ADMIN_LAYOUT_SCALE, y: 10 * ADMIN_LAYOUT_SCALE, w: 460 * ADMIN_LAYOUT_SCALE, h: 300 * ADMIN_LAYOUT_SCALE };
                                const clamp2 = (v, mn, mx) => Math.max(mn, Math.min(mx, v));

                                const offX = pt.x - cx;
                                const offY = pt.y - cy;

                                // Snap-to-grid utility function
                                const GRID_SIZE = 20;
                                const snapToGrid = (val) => Math.round(val / GRID_SIZE) * GRID_SIZE;

                                const moveHandler = (ev) => {
                                  const drag = adminLayoutDragRef.current;
                                  if (!drag) return;
                                  const p = adminLayoutClientToSvg(ev.clientX, ev.clientY);
                                  if (!p) return;
                                  let nx = p.x - drag.offX;
                                  let ny = p.y - drag.offY;
                                  nx = clamp2(nx, flr.x + 20 * ADMIN_LAYOUT_SCALE, flr.x + flr.w - 20 * ADMIN_LAYOUT_SCALE);
                                  ny = clamp2(ny, flr.y + 20 * ADMIN_LAYOUT_SCALE, flr.y + flr.h - 20 * ADMIN_LAYOUT_SCALE);
                                  const raw = rawFromDisplay(nx, ny);
                                  // Apply snap-to-grid
                                  raw.x = snapToGrid(raw.x);
                                  raw.y = snapToGrid(raw.y);
                                  drag.lastRaw = raw;
                                  drag.didMove = true;
                                  setAdminTables((prev) => prev.map((t) => (t.id === drag.tableId ? { ...t, x: raw.x, y: raw.y } : t)));
                                };

                                const upHandler = async () => {
                                  const drag = adminLayoutDragRef.current;
                                  if (!drag) return;
                                  adminLayoutDragRef.current = null;
                                  setAdminLayoutDraggingId(null);
                                  window.removeEventListener('pointermove', moveHandler);
                                  window.removeEventListener('pointerup', upHandler);

                                  if (!drag.didMove) {
                                    setAdminLayoutSelectedId(prev => prev === drag.tableId ? null : drag.tableId);
                                    return;
                                  }

                                  const raw = drag.lastRaw || { x: prevX, y: prevY };
                                  try {
                                    await api.admin.tables.setLayout(adminId, drag.tableId, raw.x, raw.y);
                                    toast?.ok?.(t('admin_layout_saved'));
                                  } catch (err) {
                                    toast?.err?.(err?.message || t('admin_layout_save_failed'));
                                    setAdminTables((prev) => prev.map((t) => (t.id === drag.tableId ? { ...t, x: prevX, y: prevY } : t)));
                                  }
                                };

                                adminLayoutDragRef.current = {
                                  tableId: tbl.id,
                                  offX,
                                  offY,
                                  prevX,
                                  prevY,
                                  didMove: false,
                                  lastRaw: { x: prevX, y: prevY },
                                  moveHandler,
                                  upHandler,
                                };
                                setAdminLayoutDraggingId(tbl.id);
                                window.addEventListener('pointermove', moveHandler);
                                window.addEventListener('pointerup', upHandler);
                              }}
                            >
                              <rect
                                x={-w / 2}
                                y={-h / 2}
                                width={w}
                                height={h}
                                rx={round ? Math.min(w, h) / 2 : booth ? 14 : 10}
                                fill={busy ? 'rgba(201,169,110,0.75)' : selected ? 'rgba(201,169,110,0.22)' : isBlocked ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.35)'}
                                stroke={busy || selected ? 'rgba(232,202,144,0.95)' : 'rgba(255,255,255,0.12)'}
                                strokeWidth={selected ? 2 : 1}
                              />
                              <text
                                x="0"
                                y="4"
                                textAnchor="middle"
                                fill={busy ? '#0b0b0b' : 'rgba(242,237,230,0.92)'}
                                fontSize="11"
                                fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Arial"
                                style={{ userSelect: 'none' }}
                              >
                                {label}
                              </text>
                              {selected && (
                                <g
                                  transform={`translate(${w / 2 + 2}, ${-h / 2 - 2})`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAdminLayoutSelectedId(null);
                                    deleteTable(tbl);
                                  }}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <circle cx="0" cy="0" r="8" fill="rgba(192,71,59,0.92)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                                  <path d="M-3.5 -3.5l7 7M3.5 -3.5l-7 7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                                </g>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                      {/* Zoom Controls Overlay - Bottom Right */}
                      <div style={{
                        position: 'absolute',
                        bottom: 12,
                        right: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'rgba(15,15,16,0.85)',
                        padding: '8px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.12)',
                        backdropFilter: 'blur(8px)',
                      }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: '4px 8px', minWidth: 0 }}
                          onClick={() => adminLayoutSetZoom(Math.max(ADMIN_LAYOUT_MIN_ZOOM, adminLayoutZoom - 0.15))}
                          disabled={tableEditorBusy}
                          title="Zoom out"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          style={{
                            fontSize: 11,
                            padding: '4px 8px',
                            minWidth: 40,
                            textAlign: 'center',
                            background: 'rgba(201,169,110,0.10)',
                            border: '1px solid rgba(201,169,110,0.35)',
                            borderRadius: 6,
                            color: 'var(--gold)',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                          onClick={() => { setAdminLayoutPan({ x: 0, y: 0 }); setAdminLayoutZoom(1); }}
                          disabled={tableEditorBusy}
                          title="Reset zoom to 100%"
                        >
                          {Math.round(adminLayoutZoom * 100)}%
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: '4px 8px', minWidth: 0 }}
                          onClick={() => adminLayoutSetZoom(Math.min(ADMIN_LAYOUT_MAX_ZOOM, adminLayoutZoom + 0.15))}
                          disabled={tableEditorBusy}
                          title="Zoom in"
                        >
                          +
                        </button>
                      </div>

                      {/* Context Menu */}
                      {adminLayoutContextMenu && (
                        <div
                          style={{
                            position: 'fixed',
                            left: adminLayoutContextMenu.x,
                            top: adminLayoutContextMenu.y,
                            background: 'rgba(20,20,22,0.95)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 10,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.50)',
                            backdropFilter: 'blur(12px)',
                            zIndex: 10000,
                            minWidth: 180,
                            overflow: 'hidden',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Table Context Menu */}
                          {adminLayoutContextMenu.tableId && (() => {
                            const tbl = adminTables.find(t => t.id === adminLayoutContextMenu.tableId);
                            if (!tbl) return null;
                            return (
                              <>
                                <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 11, color: 'var(--muted)' }}>
                                  {tbl.name || `Товар #${tbl.id}`}
                                </div>
                                <button
                                  type="button"
                                  style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--text)',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                                  }}
                                  onMouseEnter={(e) => e.target.style.background = 'rgba(201,169,110,0.10)'}
                                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                  onClick={() => {
                                    duplicateTable(tbl);
                                  }}
                                >
                                  📋 Дублировать
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--text)',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                                  }}
                                  onMouseEnter={(e) => e.target.style.background = 'rgba(201,169,110,0.10)'}
                                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                  onClick={() => {
                                    openEditTable(tbl);
                                    setAdminLayoutContextMenu(null);
                                  }}
                                >
                                  ✎ Редактировать
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'rgba(220,80,70,0.9)',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                  }}
                                  onMouseEnter={(e) => e.target.style.background = 'rgba(220,80,70,0.12)'}
                                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                  onClick={() => {
                                    deleteTable(tbl);
                                    setAdminLayoutContextMenu(null);
                                  }}
                                >
                                  🗑 Удалить
                                </button>
                              </>
                            );
                          })()}

                          {/* Decoration Context Menu */}
                          {adminLayoutContextMenu.decorId && (() => {
                            const decor = adminLayoutDecor.find(d => d.id === adminLayoutContextMenu.decorId);
                            if (!decor) return null;
                            return (
                              <>
                                <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 11, color: 'var(--muted)' }}>
                                  {decor.type === 'wall' ? 'Стена' : decor.type === 'door' ? 'Дверь' : decor.type === 'window' ? 'Окно' : decor.type === 'zone' ? 'Зона' : 'Текст'}
                                </div>
                                <button
                                  type="button"
                                  style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--text)',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                                  }}
                                  onMouseEnter={(e) => e.target.style.background = 'rgba(201,169,110,0.10)'}
                                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                  onClick={() => {
                                    rotateDecor(decor.id, 15);
                                  }}
                                >
                                  🔄 Повернуть 15°
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--text)',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                                  }}
                                  onMouseEnter={(e) => e.target.style.background = 'rgba(201,169,110,0.10)'}
                                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                  onClick={() => {
                                    rotateDecor(decor.id, -15);
                                  }}
                                >
                                  ↶ Повернуть -15°
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--text)',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                                  }}
                                  onMouseEnter={(e) => e.target.style.background = 'rgba(201,169,110,0.10)'}
                                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                  onClick={() => {
                                    setAdminLayoutDecor((prev) => prev.map((item) => (item.id === decor.id ? { ...item, rotation: 0 } : item)));
                                  }}
                                >
                                  ⊙ Сбросить угол
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'rgba(220,80,70,0.9)',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                  }}
                                  onMouseEnter={(e) => e.target.style.background = 'rgba(220,80,70,0.12)'}
                                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                  onClick={() => {
                                    setAdminLayoutDecor((prev) => prev.filter((item) => item.id !== decor.id));
                                    setAdminLayoutSelectedDecorId(null);
                                    setAdminLayoutContextMenu(null);
                                  }}
                                >
                                  🗑 Удалить
                                </button>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {adminTablesRestaurantId && !adminTablesLoading && adminTables.length === 0 && (
                  <div className="admin-empty-state" style={{ marginTop: 12 }}>
                    <div className="admin-stub-h" style={{ marginBottom: 6 }}>Здесь будет ваш зал</div>
                    <div className="admin-muted">Добавьте первый товар, и план начнёт оживать.</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'menu' && (
            <div className="admin-split">
              <div className="admin-panel">
                <div className="admin-panel-h">
                  <div className="admin-panel-title">{t('admin_dishes')}</div>
                  <button type="button" className="btn btn-ghost" onClick={loadMenu} disabled={menuLoading}>
                    <Icons.Refresh /> {t('refresh')}
                  </button>
                </div>
                <div className="admin-panel-scroll">
                  {menuLoading && <div className="admin-muted">{t('loading')}</div>}
                  {!menuLoading && menuItems.length === 0 && (
                    <div className="admin-empty-state">
                      <div className="admin-stub-h" style={{ marginBottom: 6 }}>Каталог пока пустой</div>
                      <div className="admin-muted">Добавьте первый товар и загрузите фотографию прямо сюда перетаскиванием.</div>
                    </div>
                  )}
                  {menuItems.map((it) => (
                    <div key={it.id} className="admin-row">
                      <div className="admin-row-main">
                        <div className="admin-row-name">
                          {it.name}
                          {!it.is_active && <span className="admin-row-off">{t('admin_off')}</span>}
                        </div>
                        <div className="admin-row-sub">{it.cat} · {it.price} ₽</div>
                      </div>
                      <div className="admin-row-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => startEditMenu(it)}>{t('admin_edit')}</button>
                        <button type="button" className="btn btn-outline-gold" onClick={() => delMenu(it.id)}>{t('admin_delete')}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-panel">
                <div className="admin-panel-h">
                  <div className="admin-panel-title">{menuEditingId ? t('admin_editing_hash', { id: menuEditingId }) : t('admin_new_dish')}</div>
                  <button type="button" className="btn btn-ghost" onClick={startCreateMenu}>{t('admin_clear')}</button>
                </div>
                <div className="admin-form">
                  <div className="fi-row">
                    <div className="fg">
                      <div className="fl">{t('admin_field_category')}</div>
                      <input className="fi" type="text" value={menuForm.cat} onChange={(e) => setMenuForm((p) => ({ ...p, cat: e.target.value }))} placeholder={t('admin_ph_category')} />
                    </div>
                    <div className="fg">
                      <div className="fl">{t('admin_field_price')}</div>
                      <input className="fi" type="number" value={menuForm.price} onChange={(e) => setMenuForm((p) => ({ ...p, price: e.target.value }))} />
                    </div>
                  </div>
                  <div className="fg">
                    <div className="fl">{t('admin_field_name')}</div>
                    <input className="fi" type="text" value={menuForm.name} onChange={(e) => setMenuForm((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="fi-row">
                    <div className="fg">
                      <div className="fl">{t('admin_field_weight')}</div>
                      <input className="fi" type="text" value={menuForm.weight} onChange={(e) => setMenuForm((p) => ({ ...p, weight: e.target.value }))} placeholder={t('admin_ph_weight')} />
                    </div>
                    <div className="fg">
                      <div className="fl">{t('admin_field_badge')}</div>
                      <input className="fi" type="text" value={menuForm.badge} onChange={(e) => setMenuForm((p) => ({ ...p, badge: e.target.value }))} placeholder={t('admin_ph_badge')} />
                    </div>
                  </div>
                  <div className="fg">
                    <div className="fl">{t('admin_field_tags')}</div>
                    <input className="fi" type="text" value={menuForm.tags} onChange={(e) => setMenuForm((p) => ({ ...p, tags: e.target.value }))} placeholder={t('admin_ph_tags')} />
                  </div>
                  <div className="fg">
                    <div className="fl">{t('admin_field_image')}</div>
                    <input className="fi" type="text" value={menuForm.img} onChange={(e) => setMenuForm((p) => ({ ...p, img: e.target.value }))} placeholder={t('admin_ph_url')} />
                  </div>
                  <input
                    ref={menuUploadInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleMenuImageUpload(file);
                      e.target.value = '';
                    }}
                  />
                  <div
                    className={`admin-upload-drop${menuUploading ? ' busy' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer?.files?.[0];
                      if (file) handleMenuImageUpload(file);
                    }}
                    onClick={() => menuUploadInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        menuUploadInputRef.current?.click();
                      }
                    }}
                  >
                    <Icons.Image />
                    <strong>{menuUploading ? 'Загружаю фото…' : 'Перетащите фото сюда'}</strong>
                    <span>или нажмите, чтобы выбрать из проводника</span>
                  </div>
                  <div className="fg">
                    <div className="fl">{t('admin_field_desc')}</div>
                    <textarea className="fi" rows={3} value={menuForm.desc} onChange={(e) => setMenuForm((p) => ({ ...p, desc: e.target.value }))} />
                  </div>
                  <div className="fg">
                    <div className="fl">{t('admin_field_ingr')}</div>
                    <textarea className="fi" rows={3} value={menuForm.ingr} onChange={(e) => setMenuForm((p) => ({ ...p, ingr: e.target.value }))} />
                  </div>
                  <div className="fg" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" checked={menuForm.is_active} onChange={(e) => setMenuForm((p) => ({ ...p, is_active: e.target.checked }))} />
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>{t('admin_active_in_menu')}</span>
                  </div>
                  <button type="button" className="btn btn-gold" onClick={saveMenu}>
                    <Icons.Sparkles /> {t('admin_save')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'stoplist' && (
            <div className="admin-split">
              <div className="admin-panel">
                <div className="admin-panel-h">
                  <div>
                    <div className="admin-panel-title">{t('admin_stoplist_active')}</div>
                    <div className="admin-muted">{t('admin_stoplist_count', { count: stopActive.length })}</div>
                  </div>
                  <div className="admin-tools">
                    <input className="fi admin-mini" value={stopQuery} onChange={(e) => setStopQuery(e.target.value)} placeholder={t('admin_stoplist_search_ph')} />
                    <button type="button" className="btn btn-ghost" onClick={loadMenu} disabled={menuLoading}>
                      <Icons.Refresh /> {t('refresh')}
                    </button>
                  </div>
                </div>
                <div className="admin-panel-scroll">
                  {menuLoading && <div className="admin-muted">{t('loading')}</div>}
                  {!menuLoading && stopActive.length === 0 && <div className="admin-muted">{t('admin_stoplist_empty_active')}</div>}
                  {stopActive.map((it) => (
                    <div key={it.id} className="admin-row">
                      <div className="admin-row-main">
                        <div className="admin-row-name">{it.name}</div>
                        <div className="admin-row-sub">{it.cat} · {it.price} ₽</div>
                      </div>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost admin-stop-btn"
                          onClick={() => toggleMenuActive(it, false)}
                          disabled={stopUpdatingId === it.id}
                          title={t('admin_to_stoplist')}
                        >
                          <Icons.XIcon /> {t('admin_to_stoplist')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-panel">
                <div className="admin-panel-h">
                  <div>
                    <div className="admin-panel-title">{t('admin_stoplist_tab')}</div>
                    <div className="admin-muted">{t('admin_stoplist_count', { count: stopInactive.length })}</div>
                  </div>
                  <button type="button" className="btn btn-ghost" onClick={() => setStopQuery('')}>{t('admin_clear')}</button>
                </div>
                <div className="admin-panel-scroll">
                  {menuLoading && <div className="admin-muted">{t('loading')}</div>}
                  {!menuLoading && stopInactive.length === 0 && <div className="admin-muted">{t('admin_stoplist_empty')}</div>}
                  {stopInactive.map((it) => (
                    <div key={it.id} className="admin-row">
                      <div className="admin-row-main">
                        <div className="admin-row-name">
                          {it.name}
                          <span className="admin-row-off">{t('admin_stoplisted')}</span>
                        </div>
                        <div className="admin-row-sub">{it.cat} · {it.price} ₽</div>
                      </div>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost admin-stop-btn"
                          onClick={() => toggleMenuActive(it, true)}
                          disabled={stopUpdatingId === it.id}
                          title={t('admin_restore_from_stoplist')}
                        >
                          <Icons.Check /> {t('admin_restore_from_stoplist')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'stats' && (
            <div className="admin-split">
              <div className="admin-panel">
                <div className="admin-panel-h">
                  <div>
                    <div className="admin-panel-title">{t('admin_stats_title')}</div>
                    <div className="admin-muted">{t('admin_stats_auto')}</div>
                  </div>
                  <div className="admin-tools">
                    <input className="fi admin-mini" value={statsQuery} onChange={(e) => setStatsQuery(e.target.value)} placeholder={t('admin_stats_search_ph')} />
                    <select className="fi admin-mini admin-select" value={statsSort} onChange={(e) => setStatsSort(e.target.value)} aria-label={t('admin_stats_sort')}>
                      <option value="orders24h_desc">{t('admin_stats_sort_24h')}</option>
                      <option value="revenue24h_desc">{t('admin_stats_sort_revenue')}</option>
                      <option value="orders_total_desc">{t('admin_stats_sort_total')}</option>
                      <option value="name_asc">{t('admin_stats_sort_name')}</option>
                    </select>
                    <button type="button" className="btn btn-ghost" onClick={loadAdminOrders} disabled={adminOrdersLoading}>
                      <Icons.Refresh /> {t('refresh')}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={loadMenu} disabled={menuLoading}>
                      <Icons.Refresh /> {t('refresh')}
                    </button>
                  </div>
                </div>

                <div className="admin-panel-scroll">
                  {adminOrdersLoading && <div className="admin-muted">{t('loading')}</div>}
                  {menuLoading && <div className="admin-muted">{t('loading')}</div>}
                  {!menuLoading && statsRows.length === 0 && <div className="admin-muted">{t('admin_menu_empty')}</div>}
                  {!menuLoading && statsRows.length > 0 && statsFilteredSorted.length === 0 && <div className="admin-muted">{t('admin_stats_no_match')}</div>}
                  {statsFilteredSorted.map((r, idx) => {
                    const it = r.it;
                    const curDisc = clampPercent(it.discount_percent || 0);
                    const suggested = r.suggestedDiscount;
                    const basePrice = Number(it.price || 0);
                    const fp = r.priceNow;
                    const draft = discountDraft[it.id] ?? String(curDisc);
                    const demandKey = r.demandTier === 'high' ? 'admin_demand_high' : r.demandTier === 'mid' ? 'admin_demand_mid' : 'admin_demand_low';
                    const deltaTxt = `${r.delta24h > 0 ? '+' : ''}${r.delta24h}`;
                    return (
                      <div key={it.id} className="admin-row admin-stats-row">
                        <div className="admin-row-main">
                          <div className="admin-row-name">
                            <span className="admin-rank">#{idx + 1}</span>
                            {it.name}
                            {!it.is_active && <span className="admin-row-off">{t('admin_off')}</span>}
                            {curDisc > 0 && <span className="admin-disc-pill">-{curDisc}%</span>}
                            {r.ageH > 0 && r.ageH < 24 && <span className="admin-new-pill">{t('admin_stats_warming_up')}</span>}
                          </div>
                          <div className="admin-row-sub">
                            {it.cat} · {t('admin_stats_total_short', { count: r.totalOrders })} · {t('admin_stats_24h_short', { count: r.orders24h })} ({deltaTxt})
                            {' '}· {t('admin_stats_1h_short', { count: r.orders1h })}
                            {' '}· {t('admin_stats_price_now', { price: fp })}{curDisc > 0 ? ` (${t('admin_stats_price_was', { price: basePrice })})` : ''}
                            {' '}· {t('admin_stats_revenue_24h', { price: r.revenue24h })}
                            {suggested ? ` · ${t('admin_stats_suggest', { percent: suggested })}` : ''}
                          </div>
                        </div>
                        <div className="admin-row-actions admin-stats-actions">
                          <AdminSparkline data={r.series24} />
                          <span className={`admin-demand ${r.demandTier}`}>{t(demandKey)}</span>
                          <div className="admin-discount-ctl">
                            <input
                              className="fi admin-discount-inp"
                              type="number"
                              min="0"
                              max="90"
                              value={draft}
                              onChange={(e) => setDiscountDraft((p) => ({ ...p, [it.id]: e.target.value }))}
                              aria-label={t('admin_discount_percent')}
                            />
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => applyDiscount(it, draft)}
                              disabled={discountUpdatingId === it.id}
                            >
                              {t('admin_apply')}
                            </button>
                            {suggested ? (
                              <button
                                type="button"
                                className="btn btn-outline-gold"
                                onClick={() => { setDiscountDraft((p) => ({ ...p, [it.id]: String(suggested) })); applyDiscount(it, suggested); }}
                                disabled={discountUpdatingId === it.id || suggested === curDisc}
                              >
                                {t('admin_apply_suggested', { percent: suggested })}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => { setDiscountDraft((p) => ({ ...p, [it.id]: '0' })); applyDiscount(it, 0); }}
                              disabled={discountUpdatingId === it.id || curDisc === 0}
                            >
                              {t('reset')}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="admin-panel">
                <div className="admin-panel-h">
                  <div className="admin-panel-title">{t('admin_stats_dashboard')}</div>
                </div>
                <div className="admin-panel-scroll">
                  <div className="admin-chart-card">
                    <div className="admin-chart-head">
                      <div>
                        <div className="admin-chart-title">{t('admin_stats_chart_24h')}</div>
                        <div className="admin-muted">
                          {t('admin_stats_total_24h', { count: statsSummary.total24h })}
                          {' '}({statsSummary.delta24h > 0 ? '+' : ''}{statsSummary.delta24h})
                        </div>
                      </div>
                      <div className="admin-kpi">
                        <div className="admin-kpi-v">{statsSummary.total24h}</div>
                        <div className="admin-kpi-k">{t('admin_stats_orders_24h_short')}</div>
                      </div>
                    </div>
                    <AdminLineChart data={statsSummary.totalByHour} height={150} />
                  </div>

                  <div className="admin-chart-card">
                    <div className="admin-chart-title">{t('admin_stats_by_category')}</div>
                    <div className="admin-bars">
                      {statsSummary.cats.slice(0, 10).map((c) => {
                        const max = statsSummary.cats[0]?.orders || 1;
                        const pct = Math.round((c.orders / max) * 100);
                        return (
                          <div key={c.cat} className="admin-bar-row">
                            <div className="admin-bar-label" title={c.cat}>{c.cat}</div>
                            <div className="admin-bar-track">
                              <div className="admin-bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="admin-bar-val">{c.orders}</div>
                          </div>
                        );
                      })}
                      {statsSummary.cats.length === 0 && <div className="admin-muted">{t('admin_menu_empty')}</div>}
                    </div>
                  </div>

                  <div className="admin-chart-card">
                    <div className="admin-chart-title">{t('admin_stats_new_dishes')}</div>
                    {statsSummary.newDishes.slice(0, 8).map((r) => (
                      <div key={r.it.id} className="admin-suggest-row">
                        <div className="admin-suggest-name">{r.it.name}</div>
                        <div className="admin-suggest-pill">
                          {t('admin_stats_warming_up')}
                        </div>
                      </div>
                    ))}
                    {statsSummary.newDishes.length === 0 && <div className="admin-muted">{t('admin_stats_no_new')}</div>}
                  </div>

                  <div className="admin-stub">
                    <div className="admin-stub-h">{t('admin_stats_note_title')}</div>
                    <div className="admin-muted">{t('admin_stats_note')}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'events' && (
            <div className="admin-split">
              <div className="admin-panel">
                <div className="admin-panel-h">
                  <div className="admin-panel-title">{t('admin_events')}</div>
                  <button type="button" className="btn btn-ghost" onClick={loadEvents} disabled={eventsLoading}>
                    <Icons.Refresh /> {t('refresh')}
                  </button>
                </div>
                <div className="admin-panel-scroll">
                  {eventsLoading && <div className="admin-muted">{t('loading')}</div>}
                  {!eventsLoading && events.length === 0 && <div className="admin-muted">{t('admin_no_events')}</div>}
                  {events.map((ev) => (
                    <div key={ev.id} className="admin-row">
                      <div className="admin-row-main">
                        <div className="admin-row-name">
                          {ev.title}
                          {ev.is_private && <span className="admin-pro"><Icons.Diamond /> PRO</span>}
                        </div>
                      <div className="admin-row-sub">{ev.starts_at ? String(ev.starts_at).slice(0, 10) : t('admin_no_date')}</div>
                      </div>
                      <div className="admin-row-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => startEditEvent(ev)}>{t('admin_edit')}</button>
                        <button type="button" className="btn btn-outline-gold" onClick={() => delEvent(ev.id)}>{t('admin_delete')}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-panel">
                <div className="admin-panel-h">
                  <div className="admin-panel-title">{eventEditingId ? t('admin_editing_hash', { id: eventEditingId }) : t('admin_new_event')}</div>
                  <button type="button" className="btn btn-ghost" onClick={startCreateEvent}>{t('admin_clear')}</button>
                </div>
                <div className="admin-form">
                  <div className="fg">
                    <div className="fl">{t('admin_field_title')}</div>
                    <input className="fi" type="text" value={eventForm.title} onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))} />
                  </div>
                  <div className="fg">
                    <div className="fl">{t('admin_field_description')}</div>
                    <textarea className="fi" rows={3} value={eventForm.description} onChange={(e) => setEventForm((p) => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div className="fi-row">
                    <div className="fg">
                      <div className="fl">{t('admin_field_datetime')}</div>
                      <input className="fi" type="datetime-local" value={eventForm.starts_at} onChange={(e) => setEventForm((p) => ({ ...p, starts_at: e.target.value }))} />
                    </div>
                    <div className="fg">
                      <div className="fl">{t('admin_field_private')}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                        <input type="checkbox" checked={eventForm.is_private} onChange={(e) => setEventForm((p) => ({ ...p, is_private: e.target.checked }))} />
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>{t('admin_private_only_pro')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="fg">
                    <div className="fl">{t('admin_field_image')}</div>
                    <input
                      ref={eventUploadInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleEventImageUpload(file);
                        e.target.value = '';
                      }}
                    />
                    <div
                      className={`admin-upload-drop${eventUploading ? ' busy' : ''}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer?.files?.[0];
                        if (file) handleEventImageUpload(file);
                      }}
                      onClick={() => eventUploadInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          eventUploadInputRef.current?.click();
                        }
                      }}
                    >
                      {eventForm.image_url ? (
                        <img src={eventForm.image_url} alt="" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                      ) : (
                        <>
                          <Icons.Image />
                          <strong>{eventUploading ? 'Загружаю фото…' : 'Перетащите фото сюда'}</strong>
                          <span>или нажмите, чтобы выбрать из проводника</span>
                        </>
                      )}
                    </div>
                    <input className="fi" type="text" style={{ marginTop: 8 }} value={eventForm.image_url} onChange={(e) => setEventForm((p) => ({ ...p, image_url: e.target.value }))} placeholder={t('admin_ph_url')} />
                  </div>
                  <button type="button" className="btn btn-gold" onClick={saveEvent}>
                    <Icons.Gift /> {t('admin_save_event')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'reviews' && (
            <div className="admin-split" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="admin-panel" style={{ flex: 1 }}>
                <div className="admin-panel-h">
                  <div className="admin-panel-title">{t('admin_tab_reviews')}</div>
                  <button type="button" className="btn btn-ghost" onClick={loadReviews}>
                    <Icons.Refresh /> {t('refresh')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setAdminHideOldReviews((v) => !v)}
                    title={adminHideOldReviews ? t('admin_show_all') : t('admin_hide_old_reviews')}
                  >
                    <Icons.Clock /> {adminHideOldReviews ? t('admin_show_all') : t('admin_hide_old')}
                  </button>
                </div>
                <div className="admin-panel-scroll">
                  {reviewsLoading && <div className="admin-muted">{t('loading')}</div>}
                  {!reviewsLoading && reviewsFiltered.length === 0 && <div className="admin-muted">{t('admin_reviews_empty')}</div>}
                  {reviewsFiltered.map((rv) => (
                    <div key={rv.id} className="admin-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div>
                          <div className="admin-row-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {rv.author_name}
                            <span style={{ color: 'var(--gold)', fontSize: 13 }}>{'★'.repeat(rv.rating)}{'☆'.repeat(5 - rv.rating)}</span>
                            {rv.is_featured && <span className="admin-pro"><Icons.Bookmark /> {t('admin_reviews_featured_badge')}</span>}
                          </div>
                          <div className="admin-row-sub" style={{ marginTop: 4 }}>{rv.text}</div>
                          {rv.admin_reply && (
                            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gold)', fontStyle: 'italic' }}>
                              {t('review_admin_reply_label')}: {rv.admin_reply}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={reviewUpdatingId === rv.id}
                            onClick={() => handleReviewFeature(rv.id, rv.is_featured)}
                            title={rv.is_featured ? t('admin_reviews_unfeature') : t('admin_reviews_feature')}
                          >
                            <Icons.Bookmark /> {rv.is_featured ? t('admin_reviews_unfeature') : t('admin_reviews_feature')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={reviewUpdatingId === rv.id}
                            onClick={() => { setReviewReplyId(rv.id); setReviewReplyDraft(rv.admin_reply || ''); }}
                          >
                            <Icons.Reply /> {t('admin_reviews_reply')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-gold"
                            disabled={reviewUpdatingId === rv.id}
                            onClick={() => handleReviewDelete(rv.id)}
                          >
                            <Icons.Trash /> {t('admin_delete')}
                          </button>
                        </div>
                      </div>
                      {reviewReplyId === rv.id && (
                        <div style={{ width: '100%', display: 'flex', gap: 8 }}>
                          <input
                            className="fi"
                            style={{ flex: 1 }}
                            type="text"
                            value={reviewReplyDraft}
                            onChange={(e) => setReviewReplyDraft(e.target.value)}
                            placeholder={t('admin_reviews_reply_ph')}
                            onKeyDown={(e) => e.key === 'Enter' && handleReviewReply(rv.id)}
                          />
                          <button
                            type="button"
                            className="btn btn-gold"
                            disabled={reviewUpdatingId === rv.id || !reviewReplyDraft.trim()}
                            onClick={() => handleReviewReply(rv.id)}
                          >
                            <Icons.Send /> {t('admin_reviews_reply')}
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => setReviewReplyId(null)}>
                            {t('close')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'hero' && (
            <div className="admin-scroll-panel"><div style={{ padding: '4px 0' }}>
              <div className="admin-section-title">{t('admin_hero_title')}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 18, lineHeight: 1.5 }}>{t('admin_hero_sub')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {heroConfig.map((slot, idx) => {
                  const isCustom = slot.mode === 'custom';
                  const dish = !isCustom ? heroMenuItems.find(d => Number(d.id) === Number(slot.dishId)) : null;
                  const previewImg = isCustom ? (slot.customImg || '') : (dish?.img || '');
                  return (
                    <div key={idx} style={{ border: '1px solid var(--glass-border)', borderRadius: 'var(--r-md)', padding: '14px 16px', background: 'var(--glass)' }}>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {previewImg && (
                          <img src={previewImg} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)' }}>{t('admin_hero_slot', { n: idx + 1 })}</div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button type="button" className={`btn ${!isCustom ? 'btn-gold' : 'btn-ghost'}`} style={{ padding: '5px 12px', fontSize: 10 }} onClick={() => updateHeroSlot(idx, 'mode', 'dish')}>{t('admin_hero_mode_dish')}</button>
                              <button type="button" className={`btn ${isCustom ? 'btn-gold' : 'btn-ghost'}`} style={{ padding: '5px 12px', fontSize: 10 }} onClick={() => updateHeroSlot(idx, 'mode', 'custom')}>{t('admin_hero_mode_custom')}</button>
                            </div>
                          </div>

                          {!isCustom && (
                            <div className="fg" style={{ marginBottom: 10 }}>
                              <div className="fl">{t('admin_hero_pick_dish')}</div>
                              <select className="fi" value={slot.dishId || ''} onChange={e => updateHeroSlot(idx, 'dishId', Number(e.target.value))}>
                                <option value="">{t('admin_hero_pick_dish')}</option>
                                {heroMenuItems.map(d => (
                                  <option key={d.id} value={d.id}>{d.name} — {d.price} ₽</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {isCustom && (
                            <div className="fg" style={{ marginBottom: 10 }}>
                              <div className="fl">{t('admin_hero_custom_title')}</div>
                              <input className="fi" type="text" value={slot.customTitle || ''} onChange={e => updateHeroSlot(idx, 'customTitle', e.target.value)} placeholder={t('admin_hero_custom_title_ph')} />
                            </div>
                          )}

                          <div className="fg" style={{ marginBottom: 10 }}>
                            <div className="fl">{t('admin_hero_title_override')}</div>
                            <input className="fi" type="text" value={slot.titleOverride || ''} onChange={e => updateHeroSlot(idx, 'titleOverride', e.target.value)} placeholder={isCustom ? (slot.customTitle || t('admin_hero_title_override_ph')) : (dish?.name || t('admin_hero_title_override_ph'))} />
                          </div>

                          <div className="fg" style={{ marginBottom: 10 }}>
                            <div className="fl">{t('admin_hero_tag')}</div>
                            <input className="fi" type="text" value={slot.tag || ''} onChange={e => updateHeroSlot(idx, 'tag', e.target.value)} placeholder={t('admin_hero_tag_ph')} />
                          </div>

                          <div className="fg" style={{ marginBottom: 10 }}>
                            <div className="fl">{t('admin_hero_desc')}</div>
                            <input className="fi" type="text" value={slot.desc || ''} onChange={e => updateHeroSlot(idx, 'desc', e.target.value)} placeholder={t('admin_hero_desc_ph')} />
                          </div>

                          {isCustom && (
                            <div className="fg" style={{ marginBottom: 0 }}>
                              <div className="fl">{t('admin_hero_custom_img')}</div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <input className="fi" type="text" value={slot.customImg || ''} onChange={e => updateHeroSlot(idx, 'customImg', e.target.value)} placeholder={t('admin_hero_custom_img_ph')} style={{ flex: 1, minWidth: 0 }} />
                                <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 16px', borderRadius: 'var(--r-xl)', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--muted)', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                  <Icons.Image /> {t('admin_hero_upload')}
                                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = ev => updateHeroSlot(idx, 'customImg', ev.target.result);
                                    reader.readAsDataURL(file);
                                    e.target.value = '';
                                  }} />
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 18, paddingBottom: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-gold" onClick={saveHeroConfig} disabled={heroSaved}>
                  <Icons.Check /> {heroSaved ? t('admin_hero_saved') : t('admin_hero_save')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={resetHeroConfig}>
                  <Icons.Refresh /> {t('admin_hero_reset')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={async () => {
                  let count = 0;
                  for (let i = 0; i < SLIDES.length; i++) {
                    const sl = SLIDES[i];
                    const url = sl.img || sl.imgLight;
                    if (!url) continue;
                    const ext = url.split('.').pop().split('?')[0].substring(0, 4) || 'jpg';
                    const ok = await downloadImageBlob(url, `slide_${i + 1}.${ext}`);
                    if (!ok) window.open(url, '_blank');
                    else count++;
                    await new Promise(r => setTimeout(r, 400));
                  }
                  toast?.ok?.(t('admin_hero_download_done', { count }));
                }}>
                  <Icons.Download /> {t('admin_hero_download_all')}
                </button>
              </div>
            </div></div>
          )}

          {/* ── CONTACTS tab ── */}
          {tab === 'contacts' && (
            <div className="admin-inbox">
              <div className="admin-threadlist">
                <div className="admin-threadlist-h">
                  <div className="admin-threadlist-title">Сообщения с сайта</div>
                  <button type="button" className="btn btn-ghost" onClick={loadContactMessages}>
                    <Icons.Refresh /> {t('refresh')}
                  </button>
                </div>
                <div className="admin-threadlist-scroll">
                  {contactMessages.length === 0 && (
                    <div className="admin-muted">Сообщений пока нет. Они появятся здесь после заполнения формы на странице «Контакты».</div>
                  )}
                  {contactMessages.map((msg) => (
                    <button
                      key={msg.id}
                      type="button"
                      className={`admin-thread${selectedContactMsg?.id === msg.id ? ' on' : ''}`}
                      onClick={() => { setSelectedContactMsg(msg); markContactRead(msg.id); }}
                    >
                      <div className="admin-thread-name">
                        {!msg.read && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', marginRight: 7, flexShrink: 0 }} />}
                        {msg.name}
                      </div>
                      <div className="admin-thread-preview">{msg.phone}</div>
                      <div className="admin-thread-preview" style={{ fontSize: 10, marginTop: 2, color: 'var(--muted)' }}>
                        {new Date(msg.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="admin-chat">
                {!selectedContactMsg ? (
                  <div className="admin-muted">Выберите сообщение для просмотра</div>
                ) : (
                  <>
                    <div className="admin-chat-h">
                      <div>
                        <div className="admin-chat-title">{selectedContactMsg.name}</div>
                        <div className="admin-chat-sub">{selectedContactMsg.phone} · {new Date(selectedContactMsg.date).toLocaleString('ru-RU')}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-gold"
                        onClick={() => deleteContactMsg(selectedContactMsg.id)}
                      >
                        <Icons.Trash /> Удалить
                      </button>
                    </div>
                    <div className="admin-chat-list" style={{ padding: '16px 20px' }}>
                      <div style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 'var(--r-md)',
                        padding: '16px 18px',
                        color: 'var(--text)',
                        fontSize: 14,
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                      }}>
                        {selectedContactMsg.message || <span style={{ color: 'var(--muted)' }}>Сообщение не указано</span>}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── TRANSLATIONS tab ── */}
          {tab === 'translations' && (() => {
            const langs = DICT_LANGS;
            const baseDict = DICT[transLang] || DICT.ru;
            const allKeys = Object.keys(baseDict).filter(k => {
              if (typeof baseDict[k] === 'function') return false;
              if (!transSearch.trim()) return true;
              const q = transSearch.toLowerCase();
              return k.toLowerCase().includes(q) || String(baseDict[k]).toLowerCase().includes(q)
                || String((transOverrides[transLang] || {})[k] || '').toLowerCase().includes(q);
            });
            const overridesForLang = transOverrides[transLang] || {};

            return (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
                {/* Toolbar */}
                <div className="admin-panel-h" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div className="admin-panel-title">Редактор переводов</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {langs.map(l => (
                      <button
                        key={l}
                        type="button"
                        className={`btn ${transLang === l ? 'btn-gold' : 'btn-ghost'}`}
                        style={{ padding: '6px 14px', fontSize: 11, letterSpacing: 1 }}
                        onClick={() => setTransLang(l)}
                      >
                        {l === 'ru' ? '🇷🇺 RU' : l === 'en' ? '🇬🇧 EN' : l === 'zh' ? '🇨🇳 ZH' : l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <input
                    className="fi admin-mini"
                    type="text"
                    value={transSearch}
                    onChange={e => setTransSearch(e.target.value)}
                    placeholder="Поиск по ключу или тексту…"
                    style={{ minWidth: 200, flex: 1 }}
                  />
                  <button
                    type="button"
                    className={`btn ${transSaved ? 'btn-gold' : 'btn-ghost'}`}
                    onClick={saveTranslations}
                  >
                    <Icons.Sparkles /> {transSaved ? 'Сохранено!' : 'Сохранить'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-gold"
                    title="Сбросить все переводы к умолчанию"
                    onClick={() => {
                      if (window.confirm('Сбросить все пользовательские переводы?')) {
                        setTransOverrides({});
                        setI18nOverrides({});
                        toast?.ok?.('Переводы сброшены');
                      }
                    }}
                  >
                    <Icons.Trash /> Сбросить всё
                  </button>
                </div>

                {/* Keys list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
                    {allKeys.length} ключей · изменено: {Object.keys(overridesForLang).length}
                  </div>
                  {allKeys.map(key => {
                    const original = String(baseDict[key] || '');
                    const override = overridesForLang[key];
                    const hasOverride = override !== undefined;
                    return (
                      <div
                        key={key}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '220px 1fr auto',
                          gap: 10,
                          alignItems: 'start',
                          padding: '10px 12px',
                          borderRadius: 'var(--r-sm)',
                          border: `1px solid ${hasOverride ? 'rgba(201,169,110,0.35)' : 'rgba(255,255,255,0.06)'}`,
                          background: hasOverride ? 'rgba(201,169,110,0.05)' : 'transparent',
                        }}
                      >
                        <div>
                          <div style={{ fontFamily: 'monospace', fontSize: 11, color: hasOverride ? 'var(--gold2)' : 'var(--muted)', wordBreak: 'break-all' }}>{key}</div>
                          {hasOverride && (
                            <div style={{ fontSize: 11, color: 'rgba(242,237,230,0.40)', marginTop: 3, wordBreak: 'break-word' }}>
                              Исходный: {original.slice(0, 80)}{original.length > 80 ? '…' : ''}
                            </div>
                          )}
                        </div>
                        <input
                          className="fi"
                          type="text"
                          value={hasOverride ? override : original}
                          style={{ fontSize: 13, padding: '8px 12px' }}
                          onChange={e => {
                            const val = e.target.value;
                            setTransOverrides(prev => ({
                              ...prev,
                              [transLang]: { ...(prev[transLang] || {}), [key]: val },
                            }));
                          }}
                          onFocus={e => {
                            // When user starts typing in original, create an override
                            if (!hasOverride) {
                              setTransOverrides(prev => ({
                                ...prev,
                                [transLang]: { ...(prev[transLang] || {}), [key]: original },
                              }));
                            }
                          }}
                        />
                        <div style={{ display: 'flex', gap: 6 }}>
                          {hasOverride && (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              title="Сбросить к исходному"
                              style={{ padding: '6px 8px' }}
                              onClick={() => resetTranslation(transLang, key)}
                            >
                              <Icons.Refresh />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
