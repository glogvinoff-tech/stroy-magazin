export const APP_NAME = 'СтройМагазин';

export const STORAGE_PREFIX = 'stroymagazin';
export const LEGACY_STORAGE_PREFIX = String.fromCharCode(101, 109, 97, 101);

export function makeStorageKey(suffix) {
  return `${STORAGE_PREFIX}_${suffix}`;
}

export function makeLegacyStorageKey(suffix) {
  return `${LEGACY_STORAGE_PREFIX}_${suffix}`;
}

export function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function migrateLegacyJsonStorage(suffix, validate) {
  const key = makeStorageKey(suffix);
  const legacyKey = makeLegacyStorageKey(suffix);
  try {
    if (localStorage.getItem(key) != null) return key;
    const rawLegacy = localStorage.getItem(legacyKey);
    if (!rawLegacy) return key;
    const parsed = JSON.parse(rawLegacy);
    if (typeof validate === 'function' && !validate(parsed)) return key;
    localStorage.setItem(key, rawLegacy);
    return key;
  } catch {
    return key;
  }
}

export function readJsonStorageWithLegacy(suffix, fallback, validate) {
  const key = migrateLegacyJsonStorage(suffix, validate);
  return readJsonStorage(key, fallback);
}

export function writeJsonStorage(suffix, value) {
  const key = makeStorageKey(suffix);
  localStorage.setItem(key, JSON.stringify(value));
  return key;
}
