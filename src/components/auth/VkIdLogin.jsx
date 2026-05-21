import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../utils/api';
import { useI18n } from '../../hooks/useI18n';

let vkidScriptPromise = null;
const VKID_ERR_LOAD = 'vkid_sdk_load_failed';

function loadVkidSdk() {
  if (vkidScriptPromise) return vkidScriptPromise;
  vkidScriptPromise = new Promise((resolve, reject) => {
    if (window.VKIDSDK) return resolve(window.VKIDSDK);
    const existing = document.querySelector('script[data-vkid-sdk="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.VKIDSDK));
      existing.addEventListener('error', () => {
        const err = new Error(VKID_ERR_LOAD);
        err.code = VKID_ERR_LOAD;
        reject(err);
      });
      return;
    }
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://unpkg.com/@vkid/sdk@2/dist-sdk/umd/index.js';
    script.setAttribute('data-vkid-sdk', '1');
    script.onload = () => resolve(window.VKIDSDK);
    script.onerror = () => {
      const err = new Error(VKID_ERR_LOAD);
      err.code = VKID_ERR_LOAD;
      reject(err);
    };
    document.head.appendChild(script);
  });
  return vkidScriptPromise;
}

export function VkIdLogin({ onLogin, onClose, toast }) {
  const wrapRef = useRef(null);
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const sdk = await loadVkidSdk();
        if (!mounted) return;
        if (!sdk || !window.VKIDSDK) {
          throw new Error(t('vkid_sdk_unavailable'));
        }

        const VKID = window.VKIDSDK;
        VKID.Config.init({
          app: 54478211,
          // Avoid hard-coded domains (breaks dev/staging and forks).
          redirectUrl: `${window.location.origin}/`,
          responseMode: VKID.ConfigResponseMode.Callback,
          source: VKID.ConfigSource.LOWCODE,
          scope: '',
        });

        if (!wrapRef.current) return;
        wrapRef.current.innerHTML = '';
        const oAuth = new VKID.OAuthList();

        oAuth.render({
          container: wrapRef.current,
          scheme: 'dark',
          oauthList: ['vkid'],
        })
          .on(VKID.WidgetEvents.ERROR, (e) => {
            toast?.err?.(e?.message || t('vkid_err_generic'));
          })
          .on(VKID.OAuthListInternalEvents.LOGIN_SUCCESS, (payload) => {
            const code = payload?.code;
            const deviceId = payload?.device_id;
            if (!code || !deviceId) {
              toast?.err?.(t('vkid_invalid_data'));
              return;
            }
            VKID.Auth.exchangeCode(code, deviceId)
              .then(async (data) => {
                const accessToken = data?.access_token || data?.accessToken || '';
                const userId = String(data?.user_id || data?.userId || '').trim();
                const email = data?.email || undefined;
                if (!accessToken || !userId) {
                  // Keep visible info for debugging without breaking UX.
                  // eslint-disable-next-line no-console
                  console.warn('VKID exchangeCode response:', data);
                  toast?.err?.(t('vkid_exchange_incomplete'));
                  return;
                }
                const user = await api.auth.loginWithVkid(accessToken, userId, email);
                onLogin?.(user);
                toast?.ok?.(t('toast_welcome_user', { name: user?.name || t('guest') }));
                onClose?.();
              })
              .catch((e) => {
                toast?.err?.(e?.message || t('vkid_exchange_failed'));
              });
          });

        setError('');
      } catch (e) {
        const code = e?.code || '';
        const msg = code ? t(code) : e?.message;
        setError(msg || t('vkid_init_failed'));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [onClose, onLogin, t, toast]);

  if (loading) return <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('vkid_loading')}</div>;
  if (error) return <div style={{ fontSize: 12, color: 'var(--muted)' }}>{error}</div>;

  return <div ref={wrapRef} />;
}
