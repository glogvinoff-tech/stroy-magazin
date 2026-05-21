import React, { useState } from 'react';
import { Icons } from '../icons/Icons';
import { api } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../hooks/useI18n';
import { LegalModal } from './LegalModal';
import './auth.css';

export function RegisterModal({ onClose, onLogin, toast }) {
  const [f, setF] = useState({ name: '', email: '', pass: '', pass2: '', agree: false });
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [legalOpen, setLegalOpen] = useState(null);
  const { login } = useAuth();
  const { t } = useI18n();

  const upd = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async () => {
    const nameTrim = f.name.trim();
    const emailTrim = f.email.trim();
    if (!nameTrim || !f.pass) {
      toast.err(t('auth_required_fields'));
      return;
    }
    if (f.pass !== f.pass2) {
      toast.err(t('auth_passwords_mismatch'));
      return;
    }
    if (f.pass.length < 6) {
      toast.err(t('auth_password_min'));
      return;
    }
    if (!f.agree) {
      toast.err(t('auth_need_agree'));
      return;
    }

    setLoading(true);
    try {
      const user = await api.auth.register(nameTrim, f.pass, 1, emailTrim || undefined);
      login(user);
      if (emailTrim) {
        await api.auth.sendEmailCode(user.id, emailTrim);
        setCodeSent(true);
        toast.ok(t('auth_register_done_email'));
      } else {
        toast.ok(t('auth_register_done'));
        onClose();
      }
    } catch (err) {
      toast.err(err.message || t('auth_register_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="modal-ov" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal">
          <div className="m-hdr">
            <div className="m-ttl"><span className="ico">+</span>{t('auth_register_title')}</div>
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
              <input className="fi" type="text" placeholder={t('auth_username_ph')} value={f.name} onChange={upd('name')} autoComplete="username" />
            </div>
            <div className="fg">
              <div className="fl">{t('auth_email_optional')}</div>
              <input className="fi" type="email" placeholder="you@example.com" value={f.email} onChange={upd('email')} autoComplete="email" />
            </div>
            <div className="fg auth-section-spacer">
              <div className="fl"><Icons.Lock />{t('auth_password')}</div>
              <input className="fi" type="password" placeholder={t('auth_password_min_ph')} value={f.pass} onChange={upd('pass')} autoComplete="new-password" />
            </div>
            <div className="fg">
              <div className="fl"><Icons.Lock />{t('auth_password_repeat')}</div>
              <input className="fi" type="password" placeholder={t('auth_password_repeat_ph')} value={f.pass2} onChange={upd('pass2')} autoComplete="new-password" />
            </div>
            <div className="f-check">
              <input type="checkbox" id="ag" checked={f.agree} onChange={upd('agree')} />
              <label htmlFor="ag">
                {t('auth_agree_prefix')}{' '}
                <button
                  type="button"
                  className="link-like"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLegalOpen('terms'); }}
                >
                  {t('auth_terms')}
                </button>
                {' '}{t('auth_agree_and')}{' '}
                <button
                  type="button"
                  className="link-like"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLegalOpen('privacy'); }}
                >
                  {t('auth_privacy')}
                </button>
              </label>
            </div>
            <button type="submit" className="submit" disabled={loading || !f.name.trim() || !f.pass || !f.agree}>
              {loading ? t('auth_register_loading') : t('auth_register_btn')}
            </button>
            {codeSent && <p className="auth-note">{t('auth_verify_email_hint')}</p>}
          </form>
          <div className="m-ftr">
            <p>{t('auth_have_account')} <button type="button" className="link-like" onClick={onLogin}>{t('auth_signin_btn')}</button></p>
          </div>
        </div>
      </div>

      {legalOpen && <LegalModal type={legalOpen} onClose={() => setLegalOpen(null)} />}
    </>
  );
}
