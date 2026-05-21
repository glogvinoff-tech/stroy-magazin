import React, { useEffect, useState } from 'react';
import { Icons } from '../icons/Icons';
import { useI18n } from '../../hooks/useI18n';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../utils/api';

function EventCard({ ev, t, locked }) {
  const formattedDate = ev.starts_at
    ? new Date(ev.starts_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;
  return (
    <div className={`event-card${locked ? ' event-locked' : ''}`}>
      {ev.image_url && !locked && (
        <div className="event-img">
          <img src={ev.image_url} alt={ev.title} loading="lazy" />
        </div>
      )}
      {locked && (
        <div className="event-img event-img-locked">
          <Icons.Lock />
        </div>
      )}
      <div className="event-body">
        {ev.is_private && (
          <div className="event-private-badge">
            <Icons.Diamond /> PRO
          </div>
        )}
        <div className="event-title">{ev.title}</div>
        {formattedDate && <div className="event-date"><Icons.Cal /> {formattedDate}</div>}
        {!locked && ev.description && <div className="event-desc">{ev.description}</div>}
        {locked && <div className="event-desc event-desc-locked">{t('profile_event_locked')}</div>}
      </div>
    </div>
  );
}

export function EventsPage({ past = false, setPage }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.events.list(user?.id || null, past);
        if (!cancelled) setEvents(Array.isArray(data) ? data : []);
      } catch {
        // keep empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, past]);

  const titlePre = past ? t('past_events_title_pre') : t('about_story_h');
  const titleEm = past ? t('past_events_title_em') : '';
  const sub = past ? t('past_events_sub') : '';
  const emptyMsg = past ? t('past_events_empty') : '';

  return (
    <div className="page events-page">
      <div className="page-title">{titlePre} {titleEm && <em>{titleEm}</em>}</div>
      {sub && <div className="page-sub">{sub}</div>}

      {!past && (
        <div className="events-tabs">
          <button
            type="button"
            className={`cat-tab${!past ? ' on' : ''}`}
            onClick={() => setPage?.('events')}
          >
            {t('events_tab_upcoming')}
          </button>
          <button
            type="button"
            className={`cat-tab${past ? ' on' : ''}`}
            onClick={() => setPage?.('past-events')}
          >
            {t('events_tab_past')}
          </button>
        </div>
      )}
      {past && (
        <div className="events-tabs">
          <button type="button" className="cat-tab" onClick={() => setPage?.('events')}>
            ← {t('events_tab_upcoming')}
          </button>
          <button type="button" className="cat-tab on" onClick={() => setPage?.('past-events')}>
            {t('events_tab_past')}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)' }}>{t('loading')}</div>
      ) : events.length === 0 ? (
        <div className="events-empty">
          <div style={{ fontSize: 38, marginBottom: 12 }}>🎭</div>
          <div style={{ fontFamily: 'var(--ff-d)', fontSize: 22, color: 'var(--text)' }}>{emptyMsg || t('admin_no_events')}</div>
        </div>
      ) : (
        <div className="events-grid">
          {events.map(ev => (
            <EventCard key={ev.id} ev={ev} t={t} locked={ev.locked} />
          ))}
        </div>
      )}

      <style>{`
        .events-page { max-width: 1100px; margin: 0 auto; padding: 60px 32px; }
        .events-tabs { display: flex; gap: 8px; margin: 20px 0 24px; flex-wrap: wrap; }
        .events-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; margin-top: 16px; }
        .event-card {
          border: 1px solid var(--glass-border);
          border-radius: var(--r-lg);
          background: var(--glass);
          overflow: hidden;
          transition: transform .3s var(--ease), border-color .3s var(--ease);
        }
        .event-card:hover { transform: translateY(-2px); border-color: rgba(201,169,110,0.35); }
        .event-card.event-locked { opacity: 0.7; }
        .event-img { height: 180px; overflow: hidden; }
        .event-img img { width: 100%; height: 100%; object-fit: cover; }
        .event-img-locked {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.4);
          color: var(--muted);
        }
        .event-img-locked svg { width: 40px; height: 40px; opacity: .5; }
        .event-body { padding: 16px; }
        .event-private-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: var(--gold);
          border: 1px solid rgba(201,169,110,0.35);
          border-radius: 999px;
          padding: 3px 10px;
          margin-bottom: 10px;
        }
        .event-title { font-family: var(--ff-d); font-size: 20px; color: var(--text); margin-bottom: 8px; }
        .event-date {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--muted-strong);
          margin-bottom: 10px;
        }
        .event-date svg { color: var(--gold); flex-shrink: 0; }
        .event-desc { font-size: 13px; color: var(--muted-strong); line-height: 1.6; }
        .event-desc-locked { color: var(--muted); font-style: italic; }
        .events-empty { text-align: center; padding: 60px 0; }
        @media(max-width:640px) { .events-page { padding: 36px 16px; } }
      `}</style>
    </div>
  );
}
