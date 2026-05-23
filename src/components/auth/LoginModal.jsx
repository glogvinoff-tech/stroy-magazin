import React, { useState } from 'react';
import { Icons } from '../icons/Icons';
import { api } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../hooks/useI18n';
import './auth.css';

export function LoginModal({ onClose, onRegister, onForgotPassword, toast }) {
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useI18n();

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
