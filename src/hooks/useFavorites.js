import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

const STORAGE_KEY = 'favorites';

function readFavs(userKey) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return Array.isArray(all[userKey]) ? all[userKey] : [];
  } catch { return []; }
}

function writeFavs(userKey, ids) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [userKey]: ids }));
  } catch { /* ignore */ }
}

export function useFavorites() {
  const { user } = useAuth();
  const userKey = String(user?.id || 'guest');
  const [favorites, setFavorites] = useState(() => readFavs(userKey));

  useEffect(() => {
    setFavorites(readFavs(userKey));
  }, [userKey]);

  const toggle = useCallback((dishId) => {
    setFavorites(prev => {
      const id = Number(dishId);
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      writeFavs(userKey, next);
      return next;
    });
  }, [userKey]);

  const isFavorite = useCallback((dishId) => favorites.includes(Number(dishId)), [favorites]);

  return { favorites, toggle, isFavorite };
}
