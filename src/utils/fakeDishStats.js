const STORAGE_KEY = 'dish_stats_v3';

const HOUR_MS = 60 * 60 * 1000;
const HISTORY_HOURS = 48; // prev 24h + last 24h
const START_DELAY_MS = HOUR_MS; // new dish starts after ~1h

const DEMAND_PATTERN = [
  0.06, 0.04, 0.03, 0.03, 0.04, 0.06, 0.12, 0.22, 0.40, 0.62, 0.82, 0.98,
  1.06, 1.00, 0.90, 0.82, 0.90, 1.06, 1.22, 1.30, 1.16, 0.86, 0.46, 0.20,
];

function clampPercent(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(90, Math.round(n)));
}

function safeParseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function hourStartLocal(ms) {
  const d = new Date(Number(ms || 0));
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

function xorshift32(seed) {
  let x = Number(seed) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

function rand01(seed) {
  return (xorshift32(seed) >>> 0) / 4294967296;
}

function mixSeed(...parts) {
  let s = 0x9e3779b9;
  for (const p of parts) {
    s = xorshift32(s ^ (Number(p) >>> 0));
  }
  return s >>> 0;
}

function finalPrice(price, discountPercent) {
  const base = Number(price || 0);
  const disc = clampPercent(discountPercent);
  if (!disc) return Math.max(0, Math.round(base));
  return Math.max(0, Math.round(base * (100 - disc) / 100));
}

function expectedOrdersForHour(dish, entry, hourStartMs) {
  const baseSeed = entry.seed >>> 0;
  const hourOfDay = new Date(hourStartMs).getHours();
  const pattern = DEMAND_PATTERN[hourOfDay] ?? 0.6;

  const baseRate = 0.75 + rand01(mixSeed(baseSeed, 17)) * 5.25; // orders per hour at pattern=1
  const noise = 0.65 + rand01(mixSeed(baseSeed, hourStartMs, 29)) * 0.75; // 0.65..1.4

  const discount = clampPercent(dish?.discount_percent || 0);
  const discountFactor = 1 + (discount / 100) * 0.45;

  const activeFactor = dish?.is_active === false ? 0 : 1;

  const hourEndMs = hourStartMs + HOUR_MS;
  const startsAtMs = Number(entry.firstSeenAt || 0) + START_DELAY_MS;
  const warmupH = (hourEndMs - startsAtMs) / HOUR_MS;
  if (!Number.isFinite(warmupH) || warmupH <= 0) return 0;

  const ramp = Math.min(1, Math.pow(Math.min(1, warmupH / 6), 0.65));

  return baseRate * pattern * noise * discountFactor * activeFactor * ramp;
}

function sampleDeterministic(expected, seed) {
  const e = Number(expected || 0);
  if (!(e > 0)) return 0;
  const base = Math.floor(e);
  const frac = e - base;
  const u = rand01(seed);
  return base + (u < frac ? 1 : 0);
}

function ordersForHour(dish, entry, hourStartMs) {
  const expected = expectedOrdersForHour(dish, entry, hourStartMs);
  const seed = mixSeed(entry.seed, hourStartMs, dish?.id || 0, 101);
  return sampleDeterministic(expected, seed);
}

function sum(arr) {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((s, x) => s + (Number(x) || 0), 0);
}

function normalizeEntryShape(entry, currentHourStart) {
  const safe = entry && typeof entry === 'object' ? entry : {};
  const seed = Number.isFinite(Number(safe.seed)) ? (Number(safe.seed) >>> 0) : mixSeed(Date.now(), Math.random() * 1e9);
  const firstSeenAt = Number.isFinite(Number(safe.firstSeenAt)) ? Number(safe.firstSeenAt) : Date.now();
  const lastHourStart = Number.isFinite(Number(safe.lastHourStart)) ? hourStartLocal(safe.lastHourStart) : currentHourStart;
  const totalOrders = Number.isFinite(Number(safe.totalOrders)) ? Math.max(0, Math.floor(Number(safe.totalOrders))) : 0;
  const last48hRaw = Array.isArray(safe.last48h) ? safe.last48h : [];
  const last48h = last48hRaw.map((n) => Math.max(0, Math.floor(Number(n) || 0))).slice(-HISTORY_HOURS);
  while (last48h.length < HISTORY_HOURS) last48h.unshift(0);
  return { firstSeenAt, seed, lastHourStart, totalOrders, last48h };
}

function createEntry(dish, nowMs, isBootstrap) {
  const currentHourStart = hourStartLocal(nowMs);
  const seed = mixSeed(dish?.id || 0, nowMs, Math.floor(Math.random() * 1e9));

  // If this is the very first run (bootstrap), backdate existing dishes so the dashboard isn't all zeros.
  const bootstrapAgeH = 12 + rand01(mixSeed(seed, 777)) * 96; // 12..108 hours
  const firstSeenAt = isBootstrap ? nowMs - Math.round(bootstrapAgeH * HOUR_MS) : nowMs;

  const entry = {
    firstSeenAt,
    seed,
    lastHourStart: currentHourStart,
    totalOrders: 0,
    last48h: Array(HISTORY_HOURS).fill(0),
  };

  if (isBootstrap) {
    const start = currentHourStart - HISTORY_HOURS * HOUR_MS;
    const series = [];
    for (let i = 0; i < HISTORY_HOURS; i += 1) {
      const hourStartMs = start + i * HOUR_MS;
      series.push(ordersForHour(dish, entry, hourStartMs));
    }
    entry.last48h = series;

    const approxOlderHours = Math.max(0, (currentHourStart - (firstSeenAt + START_DELAY_MS)) / HOUR_MS - HISTORY_HOURS);
    const approxAvg = (0.75 + rand01(mixSeed(seed, 17)) * 5.25) * 0.72; // ~avg pattern
    entry.totalOrders = Math.floor(sum(series) + approxOlderHours * approxAvg);
  }

  return entry;
}

function advanceEntryToHour(dish, entry, targetHourStart) {
  let changed = false;
  // Prevent runaway loops if the app wasn't opened for a long time.
  const maxSteps = HISTORY_HOURS + 240; // last 48h + ~10 days buffer
  let steps = 0;
  while (entry.lastHourStart < targetHourStart && steps < maxSteps) {
    const hourStartMs = entry.lastHourStart;
    const orders = ordersForHour(dish, entry, hourStartMs);
    entry.last48h = [...entry.last48h.slice(1), orders];
    entry.totalOrders = Math.max(0, Math.floor(Number(entry.totalOrders || 0))) + orders;
    entry.lastHourStart += HOUR_MS;
    changed = true;
    steps += 1;
  }

  if (entry.lastHourStart < targetHourStart) {
    // If the gap is huge, re-fill last48h directly for the most recent window.
    const start = targetHourStart - HISTORY_HOURS * HOUR_MS;
    const series = [];
    for (let i = 0; i < HISTORY_HOURS; i += 1) {
      const hourStartMs = start + i * HOUR_MS;
      series.push(ordersForHour(dish, entry, hourStartMs));
    }
    entry.last48h = series;
    entry.lastHourStart = targetHourStart;
    changed = true;
  }

  return changed;
}

export function loadDishStatsState() {
  if (typeof window === 'undefined') return { v: 3, dishes: {} };
  const raw = safeParseJson(window.localStorage.getItem(STORAGE_KEY));
  if (!raw || typeof raw !== 'object') return { v: 3, dishes: {} };
  const v = Number(raw.v || 0);
  if (v !== 3) return { v: 3, dishes: {} };
  const dishes = raw.dishes && typeof raw.dishes === 'object' ? raw.dishes : {};
  return { v: 3, dishes };
}

export function saveDishStatsState(state) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota/security errors
  }
}

export function resetDishStatsState() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function upsertAndAdvanceDishStatsState(prevState, menuItems, nowMs) {
  const prev = prevState && typeof prevState === 'object' ? prevState : { v: 3, dishes: {} };
  const prevDishes = prev.dishes && typeof prev.dishes === 'object' ? prev.dishes : {};
  const state = { v: 3, dishes: { ...prevDishes } };

  const currentHourStart = hourStartLocal(nowMs);
  const isBootstrap = Object.keys(prevDishes).length === 0;

  let changed = false;

  const items = Array.isArray(menuItems) ? menuItems : [];
  for (const dish of items) {
    const id = dish && dish.id != null ? String(dish.id) : null;
    if (!id) continue;
    if (!state.dishes[id]) {
      state.dishes[id] = createEntry(dish, nowMs, isBootstrap);
      changed = true;
    }
  }

  for (const dish of items) {
    const id = dish && dish.id != null ? String(dish.id) : null;
    if (!id) continue;
    const entry = normalizeEntryShape(state.dishes[id], currentHourStart);
    const didAdvance = advanceEntryToHour(dish, entry, currentHourStart);
    if (didAdvance) changed = true;
    if (state.dishes[id] !== entry) state.dishes[id] = entry;
  }

  return { state, changed, meta: { historyHours: HISTORY_HOURS, startDelayMs: START_DELAY_MS } };
}

export function getDishSeries48(state, dishId) {
  const id = dishId == null ? null : String(dishId);
  if (!id) return Array(HISTORY_HOURS).fill(0);
  const entry = state?.dishes?.[id];
  const currentHourStart = hourStartLocal(Date.now());
  const safe = normalizeEntryShape(entry, currentHourStart);
  return safe.last48h;
}

export function getDishTotalOrders(state, dishId) {
  const id = dishId == null ? null : String(dishId);
  if (!id) return 0;
  const entry = state?.dishes?.[id];
  const currentHourStart = hourStartLocal(Date.now());
  const safe = normalizeEntryShape(entry, currentHourStart);
  return Math.max(0, Math.floor(Number(safe.totalOrders || 0)));
}

export function getDishStartsInMs(state, dishId, nowMs) {
  const id = dishId == null ? null : String(dishId);
  if (!id) return 0;
  const entry = state?.dishes?.[id];
  const currentHourStart = hourStartLocal(nowMs);
  const safe = normalizeEntryShape(entry, currentHourStart);
  return Math.max(0, (Number(safe.firstSeenAt || 0) + START_DELAY_MS) - Number(nowMs || 0));
}

export function getDishFinalPrice(dish) {
  return finalPrice(dish?.price, dish?.discount_percent);
}
