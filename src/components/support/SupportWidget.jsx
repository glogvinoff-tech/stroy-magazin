import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { Icons } from '../icons/Icons';
import { useI18n } from '../../hooks/useI18n';
import './support.css';

const SW_POS_KEY = 'support_widget_pos:v1';

export function SupportWidget({ onOpenLogin, toast, onNavigate }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const listRef = useRef(null);
  const pollRef = useRef(null);
  const wrapRef = useRef(null);
  const dragRef = useRef({ pointerId: null, startX: 0, startY: 0, startLeft: 0, startTop: 0 });
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(SW_POS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null;
      return { x: parsed.x, y: parsed.y };
    } catch {
      return null;
    }
  });

  const isPro = Boolean(user?.is_pro);

  const title = useMemo(() => (isPro ? t('support_title_vip') : t('support_title')), [isPro, t]);

  const clampToViewport = useCallback((x, y, rect) => {
    if (typeof window === 'undefined') return { x, y };
    const margin = 12;
    const maxX = Math.max(margin, window.innerWidth - margin - rect.width);
    const maxY = Math.max(margin, window.innerHeight - margin - rect.height);
    return {
      x: Math.min(Math.max(margin, x), maxX),
      y: Math.min(Math.max(margin, y), maxY),
    };
  }, []);

  useEffect(() => {
    if (!pos) return;
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SW_POS_KEY, JSON.stringify(pos));
    } catch {
      // ignore storage errors
    }
  }, [pos]);

  useEffect(() => {
    if (!open) return;
    const handleResize = () => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos((p) => {
        if (!p) return p;
        const next = clampToViewport(p.x, p.y, rect);
        if (next.x === p.x && next.y === p.y) return p;
        return next;
      });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [open, clampToViewport]);

  const onHeadPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target?.closest?.('.sw-head-actions')) return;
    if (e.target?.closest?.('button, a, input, textarea, select')) return;
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    setPos({ x: rect.left, y: rect.top });
    setDragging(true);
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onHeadPointerMove = (e) => {
    const d = dragRef.current;
    if (d.pointerId == null || d.pointerId !== e.pointerId) return;
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const next = clampToViewport(d.startLeft + dx, d.startTop + dy, rect);
    setPos(next);
  };

  const onHeadPointerUp = (e) => {
    const d = dragRef.current;
    if (d.pointerId == null || d.pointerId !== e.pointerId) return;
    dragRef.current.pointerId = null;
    setDragging(false);
  };

  const loadThreadAndMessages = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const th = await api.support.getThread(user.id);
      setThread(th);
      const msgs = await api.support.listMessages(th.id, user.id);
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (e) {
      toast?.err?.(e.message || t('support_err_unavailable'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (!user?.id) return;
    loadThreadAndMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  useEffect(() => {
    if (!open || !user?.id || !thread?.id) return;
    pollRef.current = setInterval(async () => {
      try {
        const msgs = await api.support.listMessages(thread.id, user.id);
        setMessages(Array.isArray(msgs) ? msgs : []);
      } catch {
        // ignore transient errors
      }
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [open, thread?.id, user?.id]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

  const send = async () => {
    if (!user?.id) return;
    if (!thread?.id) return;
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setSending(true);
    try {
      await api.support.sendMessage(thread.id, user.id, text);
      const msgs = await api.support.listMessages(thread.id, user.id);
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (e) {
      toast?.err?.(e.message || t('support_err_send_failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {!open && (
        <button type="button" className="sw-tab" onClick={() => setOpen(true)} aria-label={t('support_open')}>
          <span className="sw-tab-ico"><Icons.Message /></span>
          <span className="sw-tab-txt">{isPro ? t('support_tab_vip') : t('support_tab_chat')}</span>
        </button>
      )}

      {open && (
        <div
          ref={wrapRef}
          className={`sw-wrap${dragging ? ' dragging' : ''}`}
          role="dialog"
          aria-label={t('support_dialog')}
          style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined}
        >
          <div
            className="sw-head"
            onPointerDown={onHeadPointerDown}
            onPointerMove={onHeadPointerMove}
            onPointerUp={onHeadPointerUp}
            onPointerCancel={onHeadPointerUp}
          >
            <div className="sw-head-left">
              <div className="sw-title">
                <Icons.Message /> {title}
                {isPro && <span className="sw-vip"><Icons.Diamond /> PRO</span>}
              </div>
              <div className="sw-sub">
                {t('support_sub_support')}
              </div>
            </div>
              <div className="sw-head-actions">
              <button type="button" className="sw-close" aria-label={t('support_close')} onClick={() => setOpen(false)}>
                <Icons.XIcon />
              </button>
            </div>
          </div>

          {!user?.id ? (
            <div className="sw-empty">
              <div className="sw-empty-title">{t('support_need_login')}</div>
              <div className="sw-empty-sub">{t('support_need_login_sub')}</div>
              <button type="button" className="btn btn-gold" onClick={onOpenLogin}>
                <Icons.User /> {t('title_login')}
              </button>
            </div>
          ) : (
            <>
              <div className="sw-list" ref={listRef}>
                {loading && <div className="sw-sys">{t('loading')}</div>}
                {!loading && messages.length === 0 && (
                  <div className="sw-sys">
                    {t('support_empty')}
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`sw-msg ${m.sender_role === 'admin' ? 'admin' : m.sender_role === 'assistant' ? 'assistant' : 'user'}`}>
                    <div className="sw-bubble">
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="sw-quick-actions">
                <div className="sw-quick-label">{t('support_quick_actions')}</div>
                <div className="sw-quick-btns">
                  <button
                    type="button"
                    className="sw-quick-btn"
                    onClick={() => {
                      setDraft(t('support_action_reserve'));
                    }}
                  >
                    <Icons.Cal /> {t('support_action_reserve')}
                  </button>
                  <button
                    type="button"
                    className="sw-quick-btn"
                    onClick={() => {
                      if (onNavigate) onNavigate('menu');
                      else setDraft(t('support_action_catalog'));
                    }}
                  >
                    <Icons.Menu /> {t('support_action_catalog')}
                  </button>
                  <button
                    type="button"
                    className="sw-quick-btn"
                    onClick={() => setDraft(t('support_action_question') + ': ')}
                  >
                    <Icons.Info /> {t('support_action_question')}
                  </button>
                  <button
                    type="button"
                    className="sw-quick-btn sw-quick-btn-red"
                    onClick={() => setDraft(t('support_action_complaint') + ': ')}
                  >
                    <Icons.Sparkles /> {t('support_action_complaint')}
                  </button>
                </div>
              </div>
              <div className="sw-foot">
                <input
                  className="fi sw-inp"
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={isPro ? t('support_ph_vip') : t('support_ph')}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  disabled={loading || sending}
                />
                <button type="button" className="sw-send" onClick={send} disabled={loading || sending || !draft.trim()} aria-label={t('support_send')}>
                  <Icons.Send />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
