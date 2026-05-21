import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../hooks/useI18n';

const API_BASE = (process.env.REACT_APP_API_BASE || '/api').replace(/\/+$/, '');

export function OfficialTelegramLogin() {
  const { t } = useI18n();
  const wrapRef = useRef(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/telegram/official/widget-config`);
        if (!res.ok) {
          throw new Error(t('tg_err_not_configured'));
        }
        const data = await res.json();
        if (!mounted) return;
        setConfig(data);
      } catch (e) {
        if (!mounted) return;
        setError(e.message || t('tg_err_load_failed'));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    if (!wrapRef.current || !config?.bot_username || !config?.auth_url) return;
    wrapRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', String(config.bot_username).replace('@', ''));
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-auth-url', config.auth_url);
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-radius', '10');
    wrapRef.current.appendChild(script);
  }, [config]);

  if (loading) {
    return <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('tg_loading')}</div>;
  }

  if (error) {
    return <div style={{ fontSize: 12, color: 'var(--muted)' }}>{error}</div>;
  }

  return <div ref={wrapRef} />;
}
