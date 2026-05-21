import React, { useMemo } from 'react';
import { Icons } from '../icons/Icons';
import { useI18n } from '../../hooks/useI18n';

const SECTIONS = [
  {
    titleKey: 'pro_sec1_title',
    icon: Icons.Diamond,
    itemKeys: [
      'pro_sec1_i1',
      'pro_sec1_i2',
      'pro_sec1_i3',
      'pro_sec1_i4',
      'pro_sec1_i5',
      'pro_sec1_i6',
    ],
  },
  {
    titleKey: 'pro_sec2_title',
    icon: Icons.Coins,
    itemKeys: [
      'pro_sec2_i1',
      'pro_sec2_i2',
      'pro_sec2_i3',
      'pro_sec2_i4',
    ],
  },
  {
    titleKey: 'pro_sec3_title',
    icon: Icons.Sparkles,
    itemKeys: [
      'pro_sec3_i1',
      'pro_sec3_i2',
      'pro_sec3_i3',
      'pro_sec3_i4',
    ],
  },
  {
    titleKey: 'pro_sec4_title',
    icon: Icons.HeartPulse,
    itemKeys: [
      'pro_sec4_i1',
      'pro_sec4_i2',
      'pro_sec4_i3',
      'pro_sec4_i4',
    ],
  },
  {
    titleKey: 'pro_sec5_title',
    icon: Icons.Gift,
    itemKeys: [
      'pro_sec5_i1',
      'pro_sec5_i2',
      'pro_sec5_i3',
    ],
  },
  {
    titleKey: 'pro_sec6_title',
    icon: Icons.Sliders,
    itemKeys: [
      'pro_sec6_i1',
      'pro_sec6_i2',
      'pro_sec6_i3',
    ],
  },
];

export function ProModal({ isPro, onActivate, onDeactivate, onClose }) {
  const { t } = useI18n();
  const { title, subtitle } = useMemo(() => {
    if (isPro) return { title: t('pro_title_on'), subtitle: t('pro_sub_on') };
    return { title: t('pro_title_off'), subtitle: t('pro_sub_off') };
  }, [isPro, t]);

  return (
    <div className="modal-ov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="m-hdr">
          <div className="m-ttl"><span className="ico">◆</span>{title}</div>
          <button type="button" className="m-x" onClick={onClose} aria-label={t('close')}>
            <Icons.Close />
          </button>
        </div>

        <div className="m-body pro-body">
          <div className="pro-hero">
            <div className="pro-hero-left">
              <div className="pro-pill"><Icons.Diamond /> YOMAYO PRO</div>
              <div className="pro-sub">{subtitle}</div>
            </div>
            <div className="pro-hero-right">
              <div className="pro-badge">
                <div className="pro-badge-top">VIP</div>
                <div className="pro-badge-mid">Access</div>
                <div className="pro-badge-bot">24/7</div>
              </div>
            </div>
          </div>

          <div className="pro-grid">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.titleKey} className="pro-card">
                  <div className="pro-card-h">
                    <span className="pro-ico"><Icon /></span>
                    <span>{t(s.titleKey)}</span>
                  </div>
                  <ul className="pro-list">
                    {s.itemKeys.map((k) => <li key={k}>{t(k)}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="pro-note">
            {t('pro_note_demo')}
          </div>
        </div>

        <div className="m-ftr pro-ftr">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('pro_btn_later')}</button>
          {!isPro ? (
            <button type="button" className="btn btn-gold" onClick={onActivate}>
              <Icons.Sparkles /> {t('pro_btn_activate')}
            </button>
          ) : (
            <button type="button" className="btn btn-outline-gold" onClick={onDeactivate}>
              {t('pro_btn_deactivate')}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .pro-body { padding-top: 18px; }
        .pro-hero {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          padding: 16px;
          border: 1px solid var(--glass-border);
          border-radius: var(--r-lg);
          background: radial-gradient(900px 220px at 0% 0%, rgba(201,169,110,0.18), transparent 60%),
                      radial-gradient(900px 240px at 100% 20%, rgba(232,202,144,0.10), transparent 60%),
                      var(--glass);
          margin-bottom: 16px;
        }
        .pro-pill {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid rgba(201,169,110,0.40);
          background: rgba(201,169,110,0.10);
          color: var(--gold2);
          font-size: 10px;
          letter-spacing: 2.8px;
          text-transform: uppercase;
        }
        .pro-pill svg { color: var(--gold); }
        .pro-sub { margin-top: 10px; color: var(--muted-strong); font-size: 12px; line-height: 1.6; }
        .pro-badge {
          width: 92px;
          height: 92px;
          border-radius: 22px;
          border: 1px solid rgba(201,169,110,0.40);
          background: linear-gradient(135deg, rgba(201,169,110,0.20), var(--glass));
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          box-shadow: 0 20px 50px rgba(201,169,110,0.12);
        }
        .pro-badge-top { font-size: 10px; letter-spacing: 4px; color: var(--muted-strong); text-transform: uppercase; }
        .pro-badge-mid { font-family: var(--ff-d); font-size: 26px; color: var(--gold2); line-height: 1; margin-top: 4px; }
        .pro-badge-bot { font-size: 10px; letter-spacing: 3px; color: var(--muted-strong); text-transform: uppercase; margin-top: 4px; }
        .pro-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .pro-card {
          border: 1px solid var(--glass-border);
          border-radius: var(--r-lg);
          padding: 14px;
          background: var(--glass);
        }
        .pro-card-h { display: flex; align-items: center; gap: 10px; color: var(--text); font-family: var(--ff-d); font-size: 20px; margin-bottom: 10px; }
        .pro-ico { display: inline-flex; color: var(--gold); }
        .pro-list { margin: 0; padding-left: 18px; color: var(--muted-strong); font-size: 12px; line-height: 1.7; }
        .pro-list li { margin: 6px 0; }
        .pro-note { margin-top: 14px; color: var(--muted); font-size: 11px; line-height: 1.6; text-align: center; }
        .pro-ftr { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
        @media (max-width: 840px) { .pro-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
