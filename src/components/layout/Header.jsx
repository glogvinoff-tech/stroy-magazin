import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../icons/Icons';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../hooks/useI18n';

export function Header({ scrolled, page, setPage, setModal, setCartOpen, cartCount, onOpenProfile }) {
  const { user, logout } = useAuth();
  const { lang, setLang, theme, setTheme, t } = useI18n();
  const [showProfile, setShowProfile] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const profileRef = useRef(null);
  const mobileNavRef = useRef(null);
  const langRef = useRef(null);

  useEffect(() => {
    const handleDocClick = (e) => {
      const path = typeof e.composedPath === 'function' ? e.composedPath() : null;
      const isInside = (ref) => {
        const el = ref.current;
        if (!el) return false;
        const target = e.target;
        if (path && path.includes(el)) return true;
        return target instanceof Node && el.contains(target);
      };

      if (!isInside(profileRef)) setShowProfile(false);
      if (!isInside(mobileNavRef)) setShowMobileNav(false);
      if (!isInside(langRef)) setShowLang(false);
    };

    const handleEsc = (e) => {
      if (e.key !== 'Escape') return;
      setShowProfile(false);
      setShowMobileNav(false);
      setShowLang(false);
    };

    if (showProfile || showMobileNav || showLang) {
      document.addEventListener('click', handleDocClick, { capture: true });
      document.addEventListener('keydown', handleEsc);
      return () => {
        document.removeEventListener('click', handleDocClick, { capture: true });
        document.removeEventListener('keydown', handleEsc);
      };
    }
  }, [showLang, showMobileNav, showProfile]);

  const navItems = [
    { key: 'home', label: t('nav_home'), icon: Icons.Home, onClick: () => setPage('home'), active: page === 'home' },
    { key: 'menu', label: t('nav_menu'), icon: Icons.Menu, onClick: () => setPage('menu'), active: page === 'menu' },
    { key: 'about', label: t('nav_about'), icon: Icons.Info, onClick: () => setPage('about'), active: page === 'about' },
    { key: 'events', label: t('events_tab_upcoming') || 'Акции', icon: Icons.Cal, onClick: () => setPage('events'), active: page === 'events' || page === 'past-events' },
    { key: 'reviews', label: t('nav_reviews'), icon: Icons.Star, onClick: () => setPage('reviews'), active: page === 'reviews' },
    { key: 'contacts', label: t('nav_contacts'), icon: Icons.Map, onClick: () => setPage('contacts'), active: page === 'contacts' },
  ];

  return (
    <header className={`hdr${scrolled ? ' compact' : ''}`}>
      <button
        type="button"
        className="brand"
        onClick={() => {
          setShowProfile(false);
          setShowMobileNav(false);
          setShowLang(false);
          setPage('home');
        }}
        aria-label={t('aria_home')}
        title={t('nav_home')}
      >
        <div className="brand-name">СТРОЙМАН</div>
        <div className="brand-sub">{t('brand_sub')}</div>
      </button>
      <nav className="nav" aria-label={t('aria_nav')}>
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`nav-btn${item.active ? ' on' : ''}`}
            aria-current={item.active ? 'page' : undefined}
            onClick={item.onClick}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="hdr-right">
        <div className="hdr-pop" ref={mobileNavRef}>
          <button
            type="button"
            className="ico-btn mobile-only"
            onClick={() => setShowMobileNav((s) => !s)}
            aria-label={showMobileNav ? t('aria_menu_close') : t('aria_menu_open')}
            aria-haspopup="menu"
            aria-expanded={showMobileNav}
            title={t('title_menu')}
          >
            <Icons.MenuIc />
          </button>
          {showMobileNav && (
            <div className="hdr-menu" role="menu" aria-label={t('aria_nav')}>
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    className={`hdr-menu-btn${item.active ? ' on' : ''}`}
                    onClick={() => {
                      setShowMobileNav(false);
                      item.onClick();
                    }}
                  >
                    <span><Icon /> {item.label}</span>
                    {item.active && <span className="sr-only">{t('sr_current_page')}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="hdr-pop" ref={langRef}>
          <button
            type="button"
            className="ico-btn"
            onClick={() => setShowLang((s) => !s)}
            aria-label={t('lang')}
            aria-haspopup="menu"
            aria-expanded={showLang}
            title={t('lang')}
          >
            <Icons.Globe />
          </button>
          {showLang && (
            <div className="hdr-menu" role="menu" aria-label={t('lang')}>
              <button
                type="button"
                role="menuitem"
                className={`hdr-menu-btn${lang === 'ru' ? ' on' : ''}`}
                onClick={() => {
                  setLang('ru');
                  setShowLang(false);
                }}
              >
                <span>{t('lang_ru')}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={`hdr-menu-btn${lang === 'en' ? ' on' : ''}`}
                onClick={() => {
                  setLang('en');
                  setShowLang(false);
                }}
              >
                <span>{t('lang_en')}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={`hdr-menu-btn${lang === 'zh' ? ' on' : ''}`}
                onClick={() => {
                  setLang('zh');
                  setShowLang(false);
                }}
              >
                <span>{t('lang_zh')}</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="ico-btn"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={t('theme')}
          title={`${t('theme')}: ${theme === 'dark' ? t('theme_dark') : t('theme_light')}`}
        >
          {theme === 'dark' ? <Icons.Moon /> : <Icons.Sun />}
        </button>

        <button
          type="button"
          className="ico-btn"
          onClick={() => setCartOpen()}
          aria-label={cartCount > 0 ? t('aria_cart_items', { count: cartCount }) : t('aria_cart_open')}
          title={t('title_cart')}
        >
          <Icons.Cart />
          {cartCount > 0 && <span className="bdg">{cartCount}</span>}
        </button>

        <div
          className="user-menu"
          ref={profileRef}
          onMouseDownCapture={(e) => e.stopPropagation()}
          onTouchStartCapture={(e) => e.stopPropagation()}
          onPointerDownCapture={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="ico-btn"
            onClick={() => (user ? setShowProfile((s) => !s) : setModal('login'))}
            title={user ? t('title_profile') : t('title_login')}
            aria-label={user ? t('aria_profile_open') : t('title_login')}
            aria-haspopup={user ? 'menu' : undefined}
            aria-expanded={user ? showProfile : undefined}
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={t('avatar_alt')}
                style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <Icons.User />
            )}
          </button>
          {showProfile && user && (
            <div className="user-pop" role="menu" aria-label={t('aria_account')}>
              <div className="user-pop-head">{t('account')}</div>
              <div className="user-pop-name">{user.name || user.username || t('guest')}</div>
              <div className="user-pop-actions">
                <button
                  type="button"
                  role="menuitem"
                  className="user-pop-btn"
                  onClick={() => {
                    setShowProfile(false);
                    onOpenProfile && onOpenProfile();
                  }}
                >
                  {t('profile_settings')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="user-pop-btn danger"
                  onClick={() => {
                    logout();
                    setShowProfile(false);
                  }}
                >
                  {t('logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
