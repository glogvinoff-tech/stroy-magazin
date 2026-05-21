import React, { useEffect, useRef, useState } from 'react';
import { Icons } from '../icons/Icons';
import { fmtPhone } from '../../utils/helpers';
import { useI18n } from '../../hooks/useI18n';
import './auth.css';

export function ForgotPasswordModal({ onClose, onBackToLogin, toast }) {
  const { t } = useI18n();
  const [step, setStep] = useState('phone'); // phone, code, newpass
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
    };
  }, []);

  const startTimer = () => {
    setTimer(60);
    setCanResend(false);
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    if (!phone) {
      toast.err(t('auth_phone_required'));
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setStep('code');
    startTimer();
    toast.ok(t('auth_sms_sent'));
  };

  const handleVerifyCode = async () => {
    if (!code || code.length < 4) {
      toast.err(t('auth_sms_code_required'));
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setStep('newpass');
    toast.ok(t('auth_sms_code_verified'));
  };

  const handleResendCode = async () => {
    if (!canResend) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    startTimer();
    toast.ok(t('auth_sms_code_resent'));
  };

  const handleChangePassword = async () => {
    if (newPass.length < 6) {
      toast.err(t('auth_password_min'));
      return;
    }
    if (newPass !== confirmPass) {
      toast.err(t('auth_passwords_mismatch'));
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    toast.ok(t('auth_password_changed'));
    onBackToLogin();
  };

  return (
    <div className="modal-ov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="m-hdr">
          <div className="m-ttl">
            <button type="button" className="auth-back-btn" aria-label={t('back')} onClick={step === 'phone' ? onBackToLogin : () => setStep('phone')}>
              <Icons.ArrowLeft />
            </button>
            <span className="ico">*</span>
            {t('auth_reset_title')}
          </div>
          <button type="button" className="m-x" onClick={onClose} aria-label={t('close')}>
            <Icons.Close />
          </button>
        </div>

        <form
          className="m-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (loading) return;
            if (step === 'phone') handleSendCode();
            else if (step === 'code') handleVerifyCode();
            else handleChangePassword();
          }}
        >
          {step === 'phone' && (
            <>
              <div className="fg">
                <div className="fl"><Icons.Phone /> {t('auth_phone')}</div>
                <input
                  className="fi"
                  type="tel"
                  placeholder="+7 (___) ___-__-__"
                  value={phone}
                  onChange={(e) => setPhone(fmtPhone(e.target.value))}
                  autoFocus
                />
              </div>
              <p className="auth-hint">{t('auth_sms_hint')}</p>
              <button
                type="button"
                className="submit"
                onClick={handleSendCode}
                disabled={loading || !phone}
              >
                {loading ? t('auth_sending') : t('auth_get_code')}
              </button>
            </>
          )}

          {step === 'code' && (
            <>
              <div className="fg">
                <div className="fl"><Icons.Lock /> {t('auth_sms_code')}</div>
                <input
                  className="fi"
                  type="text"
                  placeholder={t('auth_sms_code_ph')}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength="4"
                  autoFocus
                />
              </div>
              <div className="auth-timer-row">
                {!canResend ? (
                  <span className="auth-timer-text">{t('auth_resend_in', { timer })}</span>
                ) : (
                  <button
                    type="button"
                    className="auth-resend-btn"
                    onClick={handleResendCode}
                    disabled={loading}
                  >
                    {t('auth_resend')}
                  </button>
                )}
              </div>
              <button
                type="button"
                className="submit"
                onClick={handleVerifyCode}
                disabled={loading || code.length < 4}
              >
                {loading ? t('auth_checking') : t('auth_confirm')}
              </button>
            </>
          )}

          {step === 'newpass' && (
            <>
              <div className="fg">
                <div className="fl"><Icons.Lock /> {t('auth_new_password')}</div>
                <input
                  className="fi"
                  type="password"
                  placeholder={t('auth_password_min_ph')}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="fg">
                <div className="fl"><Icons.Lock /> {t('auth_password_repeat')}</div>
                <input
                  className="fi"
                  type="password"
                  placeholder={t('auth_password_repeat_ph')}
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="submit"
                onClick={handleChangePassword}
                disabled={loading || !newPass || !confirmPass}
              >
                {loading ? t('auth_saving') : t('auth_save_new_password')}
              </button>
            </>
          )}
        </form>

        <div className="m-ftr">
          <p>
            <button type="button" className="link-like" onClick={onBackToLogin}>{t('auth_back_to_login')}</button>
          </p>
        </div>
      </div>
    </div>
  );
}
