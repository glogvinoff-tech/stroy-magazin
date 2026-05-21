import React, { useMemo } from 'react';
import { Icons } from '../icons/Icons';
import { useI18n } from '../../hooks/useI18n';
import './auth.css';

const TERMS = [
  {
    hKey: 'legal_terms_h1',
    pKey: 'legal_terms_p1',
  },
  {
    hKey: 'legal_terms_h2',
    pKey: 'legal_terms_p2',
  },
  {
    hKey: 'legal_terms_h3',
    pKey: 'legal_terms_p3',
  },
  {
    hKey: 'legal_terms_h4',
    pKey: 'legal_terms_p4',
  },
];

const PRIVACY = [
  {
    hKey: 'legal_privacy_h1',
    pKey: 'legal_privacy_p1',
  },
  {
    hKey: 'legal_privacy_h2',
    pKey: 'legal_privacy_p2',
  },
  {
    hKey: 'legal_privacy_h3',
    pKey: 'legal_privacy_p3',
  },
  {
    hKey: 'legal_privacy_h4',
    pKey: 'legal_privacy_p4',
  },
];

export function LegalModal({ type, onClose }) {
  const { t } = useI18n();
  const { title, subtitle, blocks } = useMemo(() => {
    if (type === 'privacy') {
      return { title: t('legal_privacy_title'), subtitle: t('legal_privacy_sub'), blocks: PRIVACY };
    }
    return { title: t('legal_terms_title'), subtitle: t('legal_terms_sub'), blocks: TERMS };
  }, [type, t]);

  return (
    <div className="modal-ov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="m-hdr">
          <div className="m-ttl"><span className="ico">§</span>{title}</div>
          <button type="button" className="m-x" onClick={onClose} aria-label={t('close')}>
            <Icons.Close />
          </button>
        </div>

        <div className="m-body legal-body">
          <p className="legal-sub">{subtitle}</p>
          <div className="legal-grid">
            {blocks.map((b) => (
              <div key={b.hKey} className="legal-card">
                <div className="legal-h">{t(b.hKey)}</div>
                <div className="legal-p">{t(b.pKey)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="m-ftr">
          <button type="button" className="btn btn-gold" onClick={onClose}>{t('close')}</button>
        </div>
      </div>
    </div>
  );
}
