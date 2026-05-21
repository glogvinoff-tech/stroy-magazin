import React, { useState } from 'react';
import { Icons } from '../icons/Icons';
import { CONTACT_INFO } from '../../utils/contactInfo';
import { useI18n } from '../../hooks/useI18n';

export function ContactsPage({ toast }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);
  const phoneDigits = (CONTACT_INFO.phone || '').replace(/\D/g, '');
  const tg = String(CONTACT_INFO.social?.telegram || '').replace(/^@/, '');
  const ig = String(CONTACT_INFO.social?.instagram || '').replace(/^@/, '');
  const vk = String(CONTACT_INFO.social?.vk || '').replace(/^@/, '');
  const waUrl = phoneDigits ? `https://wa.me/${phoneDigits}` : null;
  const tgUrl = tg ? `https://t.me/${tg}` : null;
  const igUrl = ig ? `https://instagram.com/${ig}` : null;
  const vkUrl = vk ? `https://vk.com/${vk}` : null;
  const { lat, lng } = CONTACT_INFO.coordinates || {};
  const osmEmbed = (Number.isFinite(lat) && Number.isFinite(lng))
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(`${lng - 0.01},${lat - 0.006},${lng + 0.01},${lat + 0.006}`)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast.err(t('toast_contacts_fill'));
      return;
    }
    setSending(true);
    await new Promise(r => setTimeout(r, 800));
    // Save to localStorage for admin to review
    try {
      const prev = JSON.parse(localStorage.getItem('contact_messages') || '[]');
      const entry = { id: Date.now(), date: new Date().toISOString(), name: form.name, phone: form.phone, message: form.message, read: false };
      localStorage.setItem('contact_messages', JSON.stringify([entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 200)));
    } catch { /* ignore */ }
    setSending(false);
    toast.ok(t('toast_contacts_sent'));
    setForm({ name: "", phone: "", message: "" });
  };

  // Функция для открытия карты (в реальном проекте можно использовать Яндекс/Google Maps)
  const openMap = () => {
    const url = `https://yandex.ru/maps/?pt=${CONTACT_INFO.coordinates.lng},${CONTACT_INFO.coordinates.lat}&z=17&l=map`;
    window.open(url, '_blank');
  };

  return (
    <div className="page contacts-page">
      <div className="page-title">{t('contacts_title_pre')} <em>{t('contacts_title_em')}</em></div>
      <div className="page-sub">{t('contacts_sub')}</div>

      <div className="contacts-grid">
        <div className="contacts-info">
          <div className="info-card">
            <h3 className="info-title">📍 {t('contacts_address')}</h3>
            <p className="info-text">{CONTACT_INFO.address}</p>
            <button className="btn btn-ghost btn-small" onClick={openMap}>
              <Icons.Map /> {t('contacts_show_on_map')}
            </button>
          </div>

          <div className="info-card">
            <h3 className="info-title">📞 {t('contacts_phone')}</h3>
            <a href={`tel:${phoneDigits}`} className="info-link">
              {CONTACT_INFO.phone}
            </a>
            <p className="info-note">{t('contacts_work_hours')}</p>
            <div className="call-actions">
              <a className="btn btn-gold btn-small" href={`tel:${phoneDigits}`} aria-label={t('contacts_call')}>{t('contacts_call')}</a>
              {waUrl && <a className="btn btn-ghost btn-small" href={waUrl} target="_blank" rel="noreferrer">WhatsApp</a>}
            </div>
          </div>

          <div className="info-card">
            <h3 className="info-title">✉️ {t('contacts_email')}</h3>
            <a href={`mailto:${CONTACT_INFO.email}`} className="info-link">
              {CONTACT_INFO.email}
            </a>
            <p className="info-note">{t('contacts_reply_hour')}</p>
          </div>

          <div className="info-card">
            <h3 className="info-title">🕒 {t('contacts_hours')}</h3>
            <p className="info-text">{t('contacts_work_hours')}</p>
            <p className="info-note">{t('contacts_kitchen_hours')}</p>
          </div>

          <div className="info-card social-card">
            <h3 className="info-title">{t('contacts_social')}</h3>
            <div className="social-links">
              {igUrl && (
                <a className="social-link" href={igUrl} target="_blank" rel="noreferrer">
                  <Icons.Instagram /> Instagram
                </a>
              )}
              {tgUrl && (
                <a className="social-link" href={tgUrl} target="_blank" rel="noreferrer">
                  <Icons.Telegram /> Telegram
                </a>
              )}
              {waUrl && (
                <a className="social-link" href={waUrl} target="_blank" rel="noreferrer">
                  <Icons.Phone /> WhatsApp
                </a>
              )}
              {vkUrl && (
                <a className="social-link" href={vkUrl} target="_blank" rel="noreferrer">
                  <Icons.VK /> VK
                </a>
              )}
            </div>
          </div>

          {osmEmbed && (
            <div className="info-card map-card">
              <h3 className="info-title">🗺 {t('contacts_map')}</h3>
              <div className="map-embed">
                <iframe title={t('contacts_map')} src={osmEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
              <div className="map-actions">
                <button className="btn btn-ghost btn-small" onClick={openMap}><Icons.Map /> {t('contacts_open_yandex')}</button>
                {Number.isFinite(lat) && Number.isFinite(lng) && (
                  <a className="btn btn-ghost btn-small" href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer">
                    <Icons.Share /> {t('contacts_open_google')}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="contacts-form">
          <div className="form-card">
            <h3 className="form-title">{t('contacts_write_us')}</h3>
            <p className="form-subtitle">{t('contacts_write_sub')}</p>
            
            <form onSubmit={handleSubmit}>
              <div className="fg">
                <div className="fl"><Icons.User /> {t('contacts_name')}</div>
                <input 
                  type="text" 
                  className="fi" 
                  placeholder={t('contacts_name_ph')} 
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                />
              </div>

              <div className="fg">
                <div className="fl"><Icons.Phone /> {t('contacts_phone')}</div>
                <input 
                  type="tel" 
                  className="fi" 
                  placeholder={t('contacts_phone_ph')}
                  value={form.phone}
                  onChange={e => setForm({...form, phone: e.target.value})}
                />
              </div>

              <div className="fg">
                <div className="fl"><Icons.Message /> {t('contacts_message')}</div>
                <textarea 
                  className="fi" 
                  placeholder={t('contacts_message_ph')} 
                  rows="4"
                  value={form.message}
                  onChange={e => setForm({...form, message: e.target.value})}
                  style={{resize: "vertical", minHeight: "100px"}}
                />
              </div>

              <button 
                type="submit" 
                className="submit" 
                disabled={sending || !form.name || !form.phone}
              >
                {sending ? t('contacts_sending') : t('contacts_send')}
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        .contacts-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 60px 32px;
        }

        .contacts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-top: 40px;
        }

        .contacts-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .info-card, .form-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 28px;
          transition: all 0.3s var(--ease);
        }

        .info-card:hover, .form-card:hover {
          border-color: var(--border2);
          transform: translateY(-2px);
          box-shadow: 0 16px 32px rgba(0,0,0,0.3);
        }

        .social-card {
          grid-column: span 2;
        }
        .map-card { grid-column: span 2; }
        .map-embed { margin-top: 10px; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.10); background: rgba(0,0,0,0.25); }
        .map-embed iframe { width: 100%; height: 260px; border: 0; display: block; }
        .map-actions { display:flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
        .call-actions { display:flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }

        .info-title {
          font-family: var(--ff-d);
          font-size: 18px;
          color: var(--gold);
          margin-bottom: 16px;
          letter-spacing: 1px;
        }

        .info-text {
          font-size: 14px;
          color: var(--text);
          line-height: 1.6;
          margin-bottom: 12px;
        }

        .info-link {
          display: inline-block;
          font-size: 18px;
          color: var(--text);
          text-decoration: none;
          margin-bottom: 8px;
          transition: color 0.2s;
          font-family: var(--ff-d);
        }

        .info-link:hover {
          color: var(--gold);
        }

        .info-note {
          font-size: 11px;
          color: var(--muted);
          letter-spacing: 0.5px;
        }

        .btn-small {
          padding: 8px 16px;
          font-size: 9px;
          margin-top: 8px;
        }

        .social-links {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        }

        .social-link {
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          padding: 0;
          color: var(--muted);
          text-decoration: none;
          font-size: 13px;
          font-family: var(--ff-b);
          transition: color 0.2s;
          cursor: pointer;
        }
        .social-link svg {
          width: 14px;
          height: 14px;
        }

        .social-link:hover {
          color: var(--gold);
        }

        .form-title {
          font-family: var(--ff-d);
          font-size: 24px;
          color: var(--text);
          margin-bottom: 8px;
        }

        .form-subtitle {
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 24px;
        }

        @media (max-width: 1280px) {
          .contacts-page {
            padding: 56px 28px;
          }
        }

        @media (max-width: 900px) {
          .contacts-page {
            padding: 48px 20px;
          }
          .contacts-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }

          .contacts-info {
            grid-template-columns: 1fr 1fr;
          }

          .social-card {
            grid-column: span 2;
          }
          .map-card { grid-column: span 2; }

          .social-links {
            flex-wrap: wrap;
            gap: 16px;
          }
        }

        @media (max-width: 640px) {
          .contacts-info {
            grid-template-columns: 1fr;
          }
          .social-card {
            grid-column: span 1;
          }
          .map-card { grid-column: span 1; }
        }

        @media (max-width: 540px) {
          .contacts-page {
            padding: 36px 16px;
          }
          .info-card, .form-card {
            padding: 20px 16px;
          }
          .social-links {
            gap: 14px;
          }
        }
      `}</style>
    </div>
  );
}
