import React, { useEffect, useState } from 'react';
import { Icons } from '../icons/Icons';
import { api } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../hooks/useI18n';
import { OfficialTelegramLogin } from '../../Telegram/OfficialTelegramLogin';
import { VkIdLogin } from './VkIdLogin';
import './auth.css';

export function LoginModal({ onClose, onRegister, onForgotPassword, toast }) {
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [showTelegramWidget, setShowTelegramWidget] = useState(false);
  const [showVkWidget, setShowVkWidget] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthConfig, setOauthConfig] = useState({
    google_client_id: '',
    vk_client_id: '',
  });
  const { login } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await api.auth.getPublicConfig();
        if (cancelled) return;
        setOauthConfig({
          google_client_id: cfg.google_client_id || '',
          vk_client_id: cfg.vk_client_id || '',
        });
      } catch {
        // Keep empty config; user will see actionable errors on button click.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    const nameTrim = name.trim();
    if (!nameTrim || !pass) return;
    setLoading(true);
    try {
      const user = await api.auth.login(nameTrim, pass);
      login(user);
      toast.ok(t('auth_welcome_back', { name: user.name || t('guest') }));
      onClose();
    } catch (err) {
      toast.err(err.message || t('auth_login_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const clientId = oauthConfig.google_client_id;
    if (!clientId) {
      toast.err(t('auth_google_unconfigured'));
      return;
    }
    window.sessionStorage.setItem('auth_return_to', window.location.pathname || '/');
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      include_granted_scopes: 'true',
      prompt: 'select_account',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  const handleVkLogin = () => {
    const clientId = oauthConfig.vk_client_id;
    if (!clientId) {
      toast.err(t('auth_vk_unconfigured'));
      return;
    }
    window.sessionStorage.setItem('auth_return_to', window.location.pathname || '/');
    const redirectUri = `${window.location.origin}/auth/vk/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'email',
      v: '5.199',
    });
    window.location.href = `https://oauth.vk.com/authorize?${params.toString()}`;
  };

  return (
    <div className="modal-ov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="m-hdr">
          <div className="m-ttl"><span className="ico">*</span>{t('auth_signin_title')}</div>
          <button type="button" className="m-x" onClick={onClose} aria-label={t('close')}>
            <Icons.Close />
          </button>
        </div>

        <form
          className="m-body"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="fg">
            <div className="fl"><Icons.User />{t('auth_username')}</div>
            <input
              className="fi"
              type="text"
              placeholder={t('auth_username_ph')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="fg">
            <div className="fl"><Icons.Lock />{t('auth_password')}</div>
            <input
              className="fi"
              type="password"
              placeholder={t('auth_password_ph')}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="submit" disabled={loading || !name.trim() || !pass}>
            {loading ? t('auth_signin_loading') : t('auth_signin_btn')}
          </button>

          <div className="auth-divider">
            <div className="auth-divider-title">{t('auth_other_methods')}</div>

            <div className="social-row" onClick={() => { if (showTelegramWidget) setShowTelegramWidget(false); if (showVkWidget) setShowVkWidget(false); }}>
              <button
                type="button"
                className="social-btn social-telegram"
                aria-label={t('auth_via_telegram')}
                onClick={(e) => { e.stopPropagation(); setShowTelegramWidget((s) => !s); setShowVkWidget(false); }}
                disabled={loading}
              >
                <Icons.Telegram />
              </button>
              <button
                type="button"
                className="social-btn social-google"
                aria-label={t('auth_via_google')}
                onClick={(e) => { e.stopPropagation(); handleGoogleLogin(); }}
                disabled={loading}
              >
                <Icons.Google />
              </button>
              <button
                type="button"
                className="social-btn social-vk"
                aria-label={t('auth_via_vk')}
                onClick={(e) => { e.stopPropagation(); setShowVkWidget((s) => !s); setShowTelegramWidget(false); }}
                disabled={loading}
              >
                <Icons.VK />
              </button>

              {showTelegramWidget && (
                <div className="social-popover" onClick={(e) => e.stopPropagation()}>
                  <div className="social-popover-title">{t('auth_popover_telegram')}</div>
                  <div className="social-popover-body">
                    <OfficialTelegramLogin />
                  </div>
                  <button type="button" className="btn btn-ghost auth-popover-btn" onClick={() => setShowTelegramWidget(false)}>
                    {t('close')}
                  </button>
                </div>
              )}

              {showVkWidget && (
                <div className="social-popover" onClick={(e) => e.stopPropagation()}>
                  <div className="social-popover-title">{t('auth_popover_vk')}</div>
                  <div className="social-popover-body">
                    <VkIdLogin onLogin={login} onClose={() => setShowVkWidget(false)} toast={toast} />
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-gold auth-popover-btn"
                    onClick={() => handleVkLogin()}
                  >
                    {t('auth_vk_oauth_btn')}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="forgot-row">
            <button type="button" className="forgot-link" onClick={onForgotPassword}>{t('auth_forgot')}</button>
          </div>
        </form>

        <div className="m-ftr">
          <p>{t('auth_no_account')} <button type="button" className="link-like" onClick={onRegister}>{t('auth_create')}</button></p>
        </div>
      </div>
    </div>
  );
}
