import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icons } from '../icons/Icons';
import { useYandexMaps } from '../../hooks/useYandexMaps';

function debounce(fn, ms) {
  let t = null;
  const debounced = (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => {
    if (t) clearTimeout(t);
    t = null;
  };
  return debounced;
}

export function YandexAddressModal({
  open,
  t,
  apiKey,
  initialAddress = '',
  onClose,
  onSelect,
}) {
  const { ymaps, loading, error } = useYandexMaps(apiKey);
  const mapHostRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const lastGeoReqRef = useRef(0);
  const readyPromiseRef = useRef(null);

  const [query, setQuery] = useState(String(initialAddress || ''));
  const [resolved, setResolved] = useState('');
  const [coords, setCoords] = useState(null);
  const [saveDefault, setSaveDefault] = useState(true);

  useEffect(() => {
    if (!open) return;
    setQuery(String(initialAddress || ''));
    setResolved('');
    setCoords(null);
  }, [open, initialAddress]);

  const canUseMap = !error;
  const ymapsReady = useCallback(async () => {
    if (!ymaps) return;
    if (!readyPromiseRef.current) {
      readyPromiseRef.current = new Promise((resolve) => {
        try {
          ymaps.ready(resolve);
        } catch {
          resolve();
        }
      });
    }
    await readyPromiseRef.current;
  }, [ymaps]);

  const setMarkerRef = useRef(null);
  setMarkerRef.current = (c, caption = '') => {
    if (!mapRef.current || !ymaps) return;
    const cc = Array.isArray(c) ? c : null;
    if (!cc) return;
    setCoords(cc);
    if (!markerRef.current) {
      markerRef.current = new ymaps.Placemark(cc, { balloonContent: caption }, { preset: 'islands#redIcon', draggable: true });
      mapRef.current.geoObjects.add(markerRef.current);
      markerRef.current.events.add('dragend', async () => {
        try {
          const c2 = markerRef.current?.geometry?.getCoordinates?.();
          if (!Array.isArray(c2)) return;
          setCoords(c2);
          const reqId = Date.now();
          lastGeoReqRef.current = reqId;
          const res = await ymaps.geocode(c2);
          if (lastGeoReqRef.current !== reqId) return;
          const first = res.geoObjects.get(0);
          const addr = first ? (first.getAddressLine?.() || first.getAddressLine) : '';
          const cleaned = String(addr || '').trim();
          if (cleaned) {
            setResolved(cleaned);
            setQuery(cleaned);
            markerRef.current?.properties?.set?.('balloonContent', cleaned);
          }
        } catch {
          // ignore
        }
      });
    } else {
      markerRef.current.geometry.setCoordinates(cc);
      markerRef.current.properties.set('balloonContent', caption);
    }
    mapRef.current.setCenter(cc, Math.max(16, mapRef.current.getZoom() || 16), { duration: 160 });
  };

  useEffect(() => {
    if (!open) return;
    if (!ymaps || !canUseMap) return;
    if (!mapHostRef.current) return;

    let destroyed = false;

    ymaps.ready(() => {
      if (destroyed) return;
      const host = mapHostRef.current;
      if (!host) return;

      if (mapRef.current) {
        try { mapRef.current.destroy(); } catch { /* ignore */ }
        mapRef.current = null;
      }
      markerRef.current = null;

      mapRef.current = new ymaps.Map(host, {
        center: [55.751574, 37.573856],
        zoom: 13,
        controls: ['zoomControl'],
        behaviors: ['drag', 'scrollZoom', 'dblClickZoom', 'multiTouch'],
      }, {
        suppressMapOpenBlock: true,
      });

      mapRef.current.events.add('click', async (e) => {
        try {
          const c = e.get('coords');
          if (!Array.isArray(c)) return;
          // set marker immediately for UX
          setMarkerRef.current?.(c, '');
          const reqId = Date.now();
          lastGeoReqRef.current = reqId;
          const res = await ymaps.geocode(c);
          if (lastGeoReqRef.current !== reqId) return;
          const first = res.geoObjects.get(0);
          const addr = first ? (first.getAddressLine?.() || first.getAddressLine) : '';
          setResolved(String(addr || ''));
          setQuery(String(addr || ''));
          setMarkerRef.current?.(c, addr || '');
        } catch {
          // ignore
        }
      });
    });

    return () => {
      destroyed = true;
      try { markerRef.current = null; } catch { /* ignore */ }
      try { if (mapRef.current) mapRef.current.destroy(); } catch { /* ignore */ }
      mapRef.current = null;
    };
  }, [open, ymaps, canUseMap]);

  const geocode = useMemo(() => debounce(async (text) => {
    if (!ymaps || !text || !String(text).trim()) {
      setResolved('');
      return;
    }
    try {
      await ymapsReady();
      const reqId = Date.now();
      lastGeoReqRef.current = reqId;
      const res = await ymaps.geocode(String(text).trim(), { results: 1 });
      if (lastGeoReqRef.current !== reqId) return;
      const first = res.geoObjects.get(0);
      if (!first) {
        setResolved('');
        return;
      }
      const addr = first.getAddressLine?.() || first.getAddressLine || '';
      const c = first.geometry?.getCoordinates?.();
      const bounds = first.properties?.get?.('boundedBy') || first.geometry?.getBounds?.();
      setResolved(String(addr || ''));
      if (Array.isArray(c)) {
        setMarkerRef.current?.(c, addr || '');
        if (bounds && mapRef.current?.setBounds) {
          try {
            mapRef.current.setBounds(bounds, { checkZoomRange: true, zoomMargin: 54 });
          } catch {
            // ignore
          }
        }
      }
    } catch {
      setResolved('');
    }
  }, 200), [ymaps, ymapsReady]);

  useEffect(() => {
    if (!open) return;
    if (!canUseMap) return;
    geocode(query);
    return () => geocode.cancel?.();
  }, [open, query, canUseMap, geocode]);

  if (!open) return null;

  const finalAddress = (resolved || query || '').trim();
  const okDisabled = !finalAddress;

  return (
    <div className="modal-ov" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="m-hdr">
          <div className="m-title">{t('map_title')}</div>
          <button type="button" className="m-x" onClick={onClose} aria-label={t('close')}>
            <Icons.Close />
          </button>
        </div>

        <div className="m-body" style={{ padding: 20 }}>
          {!apiKey && !ymaps && !loading && (
            <div className="admin-muted" style={{ marginBottom: 12 }}>
              {t('map_no_key')}
            </div>
          )}
          {apiKey && error && (
            <div className="admin-muted" style={{ marginBottom: 12 }}>
              {t('map_unavailable')}
            </div>
          )}

          <div className="fg" style={{ marginBottom: 12 }}>
            <div className="fl">{t('cart_address')}</div>
            <input
              className="fi"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('map_search_ph')}
            />
            {finalAddress && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted-strong)' }}>
                {t('map_found')}: {finalAddress}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--muted-strong)', fontSize: 13 }}>
              <input type="checkbox" checked={saveDefault} onChange={(e) => setSaveDefault(e.target.checked)} />
              {t('cart_save_address')}
            </label>
            <div style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 12 }}>
              {t('map_hint')}
            </div>
          </div>

          <div style={{ height: '70vh', maxHeight: 720, minHeight: 520, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border2)', background: 'rgba(255,255,255,0.03)' }}>
            {loading && <div style={{ padding: 14, color: 'var(--muted)' }}>{t('loading')}</div>}
            {canUseMap && <div ref={mapHostRef} style={{ width: '100%', height: '100%' }} />}
            {!canUseMap && !loading && (
              <div style={{ padding: 14, color: 'var(--muted)' }}>{t('map_disabled')}</div>
            )}
          </div>
        </div>

        <div className="m-foot" style={{ padding: 14, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('close')}</button>
          <button
            type="button"
            className="btn btn-gold"
            onClick={() => onSelect?.({ address: finalAddress, coords, saveDefault })}
            disabled={okDisabled}
          >
            {t('map_use')}
          </button>
        </div>
      </div>
    </div>
  );
}
