import { useEffect, useMemo, useState } from 'react';

let loadPromise = null;

function buildYandexSrc(apiKey) {
  const key = String(apiKey || '').trim();
  const qp = key ? `apikey=${encodeURIComponent(key)}&` : '';
  return `https://api-maps.yandex.ru/2.1/?${qp}lang=ru_RU`;
}

function loadYandexMaps(apiKey) {
  if (typeof window === 'undefined') return Promise.reject(new Error('no-window'));
  if (window.ymaps) return Promise.resolve(window.ymaps);
  if (loadPromise) return loadPromise;

  const src = buildYandexSrc(apiKey);
  loadPromise = new Promise((resolve, reject) => {
    const existing = Array.from(document.scripts || []).find((s) => s?.src === src);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.ymaps));
      existing.addEventListener('error', reject);
      return;
    }

    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    s.onload = () => resolve(window.ymaps);
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });

  return loadPromise;
}

export function useYandexMaps(apiKey) {
  const key = useMemo(() => String(apiKey || '').trim(), [apiKey]);
  const [ymaps, setYmaps] = useState(() => (typeof window !== 'undefined' ? window.ymaps : null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loadYandexMaps(key)
      .then((y) => {
        if (!alive) return;
        setYmaps(y);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e || new Error('load-failed'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [key]);

  return { ymaps, loading, error };
}
