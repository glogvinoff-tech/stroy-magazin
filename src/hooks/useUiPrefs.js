import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

const UiPrefsContext = createContext(null);

const LANG_KEY = 'ui_lang';
const THEME_KEY = 'ui_theme';

const normalizeLang = (v) => (v === 'en' || v === 'zh' || v === 'ru' ? v : 'ru');
const normalizeTheme = (v) => (v === 'light' || v === 'dark' ? v : 'dark');

export function UiPrefsProvider({ children }) {
  const [lang, setLang] = useState(() => normalizeLang(window.localStorage.getItem(LANG_KEY)));
  const [theme, setTheme] = useState(() => normalizeTheme(window.localStorage.getItem(THEME_KEY)));
  const didMountThemeRef = useRef(false);

  useEffect(() => {
    window.localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, theme);
    const root = document.documentElement;
    // Make theme switching feel smoother.
    if (didMountThemeRef.current) {
      root.classList.add('theme-anim');
      const id = window.setTimeout(() => root.classList.remove('theme-anim'), 420);
      root.dataset.theme = theme;
      return () => window.clearTimeout(id);
    }
    root.dataset.theme = theme;
    didMountThemeRef.current = true;
  }, [theme]);

  useEffect(() => {
    // Ensure applied on first mount as well
    document.documentElement.dataset.theme = theme;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({ lang, setLang, theme, setTheme }), [lang, theme]);
  return <UiPrefsContext.Provider value={value}>{children}</UiPrefsContext.Provider>;
}

export function useUiPrefs() {
  const ctx = useContext(UiPrefsContext);
  if (!ctx) throw new Error('useUiPrefs must be used within UiPrefsProvider');
  return ctx;
}
