import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import './menu.css';
import { Icons } from '../icons/Icons';
import { DishModal } from './DishModal';
import { useI18n } from '../../hooks/useI18n';
import { useFavorites } from '../../hooks/useFavorites';

const norm = (v) => String(v || '').trim().toLowerCase();
const hasTag = (dish, tag) => Array.isArray(dish?.tags) && dish.tags.includes(tag);
const textHas = (dish, words) => {
  const hay = norm(`${dish?.cat || ''} ${dish?.name || ''} ${dish?.desc || ''} ${dish?.ingr || ''}`);
  return words.some((w) => hay.includes(norm(w)));
};

const clampPercent = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(90, Math.round(n)));
};

const effectivePrice = (dish) => {
  const base = Number(dish?.price || 0);
  const disc = clampPercent(dish?.discount_percent || 0);
  if (!disc) return base;
  return Math.max(0, Math.round(base * (100 - disc) / 100));
};

const INCLUDE_FILTER_GROUPS = [
  {
    titleKey: 'filters_group_collection',
    items: [
      {
        key: 'hit',
        labelKey: 'filter_hit',
        icon: Icons.Sparkles,
        predicate: (d) => hasTag(d, 'хит') || d.badge === 'Хит',
      },
      {
        key: 'new',
        labelKey: 'filter_new',
        icon: Icons.Gift,
        predicate: (d) => hasTag(d, 'new') || d.badge === 'Новинка',
      },
      {
        key: 'premium',
        labelKey: 'filter_premium',
        icon: Icons.Percent,
        predicate: (d) => hasTag(d, 'акция') || hasTag(d, 'Акция') || Number(d.discount_percent || 0) > 0,
      },
      {
        key: 'healthy',
        labelKey: 'filter_healthy',
        icon: Icons.Diamond,
        predicate: (d) => hasTag(d, 'профи') || hasTag(d, 'Профи') || textHas(d, ['проф', 'professional']),
      },
    ],
  },
  {
    titleKey: 'filters_group_diet',
    items: [
      {
        key: 'vegan',
        labelKey: 'filter_vegan',
        icon: Icons.Kettlebell,
        predicate: (d) => textHas(d, ['инструмент', 'дрель', 'пила', 'шлиф', 'перфоратор']),
      },
      {
        key: 'veg',
        labelKey: 'filter_veg',
        icon: Icons.Home,
        predicate: (d) => textHas(d, ['стройматериал', 'цемент', 'кирпич', 'блок', 'профиль']),
      },
      {
        key: 'glutenFree',
        labelKey: 'filter_gluten_free',
        icon: Icons.DropletOff,
        predicate: (d) => textHas(d, ['краска', 'лак', 'грунтовка', 'эмаль', 'покрытие']),
      },
      {
        key: 'lactoseFree',
        labelKey: 'filter_lactose_free',
        icon: Icons.Sliders,
        predicate: (d) => textHas(d, ['плитка', 'керамогранит', 'ламинат', 'мозаика']),
      },
      {
        key: 'halal',
        labelKey: 'filter_halal',
        icon: Icons.DropletOff,
        predicate: (d) => textHas(d, ['сантех', 'смеситель', 'унитаз', 'радиатор']),
      },
      {
        key: 'spicy',
        labelKey: 'filter_spicy',
        icon: Icons.Settings,
        predicate: (d) => textHas(d, ['расходник', 'дюбель', 'саморез', 'лента', 'бумага']),
      },
    ],
  },
];

const EXCLUDE_ALLERGENS = [];

const ALL_INCLUDE = INCLUDE_FILTER_GROUPS.flatMap((g) => g.items);
const INCLUDE_BY_KEY = new Map(ALL_INCLUDE.map((f) => [f.key, f]));
const ALLERGEN_BY_TAG = new Map(EXCLUDE_ALLERGENS.map((a) => [a.tag, a]));

const ALL_CAT = '__all__';
const PAGE_SIZE = 12;
const PROJECT_PRESETS = [
  {
    key: 'paint',
    label: 'Покраска стен',
    query: 'краска грунтовка лента',
    unit: 'м2',
    calc: (area) => [
      `Краска: ${Math.max(1, Math.ceil(area / 7))} вед.`,
      `Грунтовка: ${Math.max(1, Math.ceil(area / 25))} кан.`,
      `Малярная лента: ${Math.max(1, Math.ceil(area / 35))} рул.`,
    ],
  },
  {
    key: 'tile',
    label: 'Плитка и пол',
    query: 'плитка керамогранит ламинат',
    unit: 'м2',
    calc: (area) => [
      `Покрытие: ${Math.ceil(area * 1.1)} м2 с запасом`,
      `Клей/смесь: ${Math.max(1, Math.ceil(area / 5))} меш.`,
      `Крестики/расходники: ${Math.max(1, Math.ceil(area / 20))} уп.`,
    ],
  },
  {
    key: 'walls',
    label: 'Перегородка',
    query: 'профиль саморез дюбель блок',
    unit: 'м2',
    calc: (area) => [
      `Профиль: ${Math.max(1, Math.ceil(area * 1.8))} шт.`,
      `Крепёж: ${Math.max(1, Math.ceil(area / 8))} уп.`,
      `Листы/блоки: ${Math.ceil(area * 1.05)} м2`,
    ],
  },
];
const CAT_KEY = {
  Супы: 'cat_soups',
  Салаты: 'cat_salads',
  Закуски: 'cat_snacks',
  Горячее: 'cat_hot',
  Десерты: 'cat_desserts',
  Напитки: 'cat_drinks',
};

export function MenuPage({ onAddToCart, onQty, onRemove, onOpenCart, cart = [], toast }) {
  const { t } = useI18n();
  const { toggle: toggleFav, isFavorite } = useFavorites();
  const [cat, setCat] = useState(ALL_CAT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('smart');
  const [maxPrice, setMaxPrice] = useState(null);
  const [selectedFilters, setSelectedFilters] = useState(() => new Set());
  const [excludedAllergens, setExcludedAllergens] = useState(() => new Set());
  const [selected, setSelected] = useState(null);
  const [added, setAdded] = useState(new Set());
  const [menuItems, setMenuItems] = useState([]);
  const [cats, setCats] = useState(() => [ALL_CAT]);
  const [restaurants, setRestaurants] = useState([]);
  const [stockRestaurantId, setStockRestaurantId] = useState('');
  const [page, setPage] = useState(1);
  const [projectKey, setProjectKey] = useState(PROJECT_PRESETS[0].key);
  const [projectArea, setProjectArea] = useState(18);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, stores] = await Promise.all([api.menu.list(), api.restaurants.list().catch(() => [])]);
        if (cancelled) return;
        const safeList = Array.isArray(list) ? list : [];
        setMenuItems(safeList);
        setRestaurants(Array.isArray(stores) ? stores : []);
        const uniq = Array.from(new Set(safeList.map((x) => x?.cat).filter(Boolean)));
        setCats([ALL_CAT, ...uniq]);
      } catch {
        setMenuItems([]);
        setCats([ALL_CAT]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stockFor = (dish) => {
    if (!stockRestaurantId) return Number(dish?.stock_total || 0);
    return Number(dish?.stock_by_restaurant?.[String(stockRestaurantId)] || 0);
  };

  const filteredByCat = useMemo(() => (cat === ALL_CAT ? menuItems : menuItems.filter((d) => d.cat === cat)), [cat, menuItems]);

  const priceBounds = useMemo(() => {
    const prices = filteredByCat.map((d) => effectivePrice(d)).filter((n) => Number.isFinite(n) && n > 0);
    const min = prices.length ? Math.min(...prices) : 0;
    const max = prices.length ? Math.max(...prices) : 0;
    return { min, max };
  }, [filteredByCat]);

  useEffect(() => {
    if (maxPrice == null) return;
    if (!priceBounds.max || maxPrice >= priceBounds.max) setMaxPrice(null);
  }, [maxPrice, priceBounds.max]);

  const effectiveMaxPrice = useMemo(() => {
    const bound = Number(priceBounds.max || 0);
    if (!bound) return 0;
    const raw = maxPrice == null ? bound : Number(maxPrice || 0);
    return Math.min(raw || 0, bound);
  }, [maxPrice, priceBounds.max]);

  const listForFacets = useMemo(() => {
    const q = norm(query);
    return filteredByCat.filter((d) => {
      if (q) {
        const hay = `${d.name || ''} ${d.desc || ''} ${d.ingr || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (effectiveMaxPrice && effectivePrice(d) > effectiveMaxPrice) return false;
      return true;
    });
  }, [effectiveMaxPrice, filteredByCat, query]);

  const listBase = useMemo(() => {
    const excluded = Array.from(excludedAllergens);
    if (!excluded.length) return listForFacets;
    return listForFacets.filter((d) => !excluded.some((t) => hasTag(d, t)));
  }, [excludedAllergens, listForFacets]);

  const filtered = useMemo(() => {
    const keys = Array.from(selectedFilters);
    if (keys.length === 0) return listBase;
    return listBase.filter((d) => keys.every((k) => (INCLUDE_BY_KEY.get(k)?.predicate || (() => true))(d)));
  }, [listBase, selectedFilters]);

  const filteredSorted = useMemo(() => {
    const scoreSmart = (d) => {
      let s = 0;
      if (hasTag(d, 'хит') || d.badge === 'Хит') s += 50;
      if (hasTag(d, 'new') || d.badge === 'Новинка') s += 25;
      if (d.badge === 'Premium') s += 10;
      if (hasTag(d, 'веган') || hasTag(d, 'veg')) s += 3;
      return s;
    };
    const isNew = (d) => hasTag(d, 'new') || d.badge === 'Новинка';

    const list = filtered.slice();
    if (sort === 'price_asc') return list.sort((a, b) => effectivePrice(a) - effectivePrice(b));
    if (sort === 'price_desc') return list.sort((a, b) => effectivePrice(b) - effectivePrice(a));
    if (sort === 'new_first') return list.sort((a, b) => (Number(isNew(b)) - Number(isNew(a))) || (scoreSmart(b) - scoreSmart(a)) || (effectivePrice(a) - effectivePrice(b)));
    // smart
    return list.sort((a, b) => (scoreSmart(b) - scoreSmart(a)) || (effectivePrice(a) - effectivePrice(b)));
  }, [filtered, sort]);

  const activeCount = selectedFilters.size + excludedAllergens.size + (norm(query) ? 1 : 0) + (maxPrice == null ? 0 : 1) + (sort === 'smart' ? 0 : 1);
  const pageCount = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const safePage = Math.min(Math.max(1, page), pageCount);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredSorted.slice(start, start + PAGE_SIZE);
  }, [filteredSorted, page, pageCount]);

  useEffect(() => {
    setPage(1);
  }, [cat, query, sort, maxPrice, selectedFilters, excludedAllergens]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const toggleInclude = (key) => {
    setSelectedFilters((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const toggleAllergen = (tag) => {
    setExcludedAllergens((s) => {
      const n = new Set(s);
      if (n.has(tag)) n.delete(tag);
      else n.add(tag);
      return n;
    });
  };

  const resetAll = () => {
    setQuery('');
    setSort('smart');
    setMaxPrice(null);
    setSelectedFilters(new Set());
    setExcludedAllergens(new Set());
  };

  const includeCount = (key) => {
    const keys = Array.from(selectedFilters).filter((k) => k !== key);
    const base = keys.length ? listBase.filter((d) => keys.every((k) => (INCLUDE_BY_KEY.get(k)?.predicate || (() => true))(d))) : listBase;
    return base.filter((d) => (INCLUDE_BY_KEY.get(key)?.predicate || (() => true))(d)).length;
  };

  const allergenCount = (tag) => listForFacets.filter((d) => hasTag(d, tag)).length;
  
  const handleAdd = (dish) => {
    if (stockRestaurantId && stockFor(dish) <= 0) {
      toast?.err?.('В выбранном магазине товара нет в наличии.');
      return;
    }
    const basePrice = Number((dish && (dish.base_price ?? dish.price)) || 0);
    const disc = clampPercent(dish?.discount_percent || 0);
    const price = disc ? Math.max(0, Math.round(basePrice * (100 - disc) / 100)) : basePrice;
    onAddToCart({ ...dish, price, discount_percent: disc, base_price: disc > 0 ? basePrice : undefined });
    toast.ok(t('toast_in_cart', { name: dish.name }));
    setAdded(p => new Set([...p, dish.id]));
    setTimeout(() => setAdded(p => { 
      const n = new Set(p); 
      n.delete(dish.id); 
      return n; 
    }), 1800);
  };

  const catLabel = (c) => {
    if (c === ALL_CAT) return t('cat_all');
    const key = CAT_KEY[c];
    return key ? t(key) : c;
  };

  const selectedProject = PROJECT_PRESETS.find((p) => p.key === projectKey) || PROJECT_PRESETS[0];
  const projectAreaSafe = Math.max(1, Math.min(999, Number(projectArea) || 1));
  const projectEstimate = selectedProject.calc(projectAreaSafe);
  const applyProjectPreset = () => {
    setCat(ALL_CAT);
    setQuery(selectedProject.query);
    setFiltersOpen(false);
    setPage(1);
  };
  
  return (
      <div className="page">
      <div className="page-title">{t('menu_title_pre')} <em>{t('menu_title_em')}</em></div>
      <div className="page-sub">{t('menu_sub')}</div>

      <div className="project-helper">
        <div className="project-helper-main">
          <div className="project-helper-title"><Icons.Home /> Комплект под задачу</div>
          <div className="project-helper-controls">
            <select className="fi project-helper-select" value={projectKey} onChange={(e) => setProjectKey(e.target.value)}>
              {PROJECT_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <label className="project-helper-area">
              <span>Площадь</span>
              <input className="fi" type="number" min="1" max="999" value={projectArea} onChange={(e) => setProjectArea(e.target.value)} />
              <span>{selectedProject.unit}</span>
            </label>
            <button type="button" className="btn btn-gold project-helper-btn" onClick={applyProjectPreset}>
              <Icons.Search /> Подобрать товары
            </button>
          </div>
        </div>
        <div className="project-helper-result">
          {projectEstimate.map((line) => <span key={line}>{line}</span>)}
        </div>
      </div>

      <div className="cat-tabs">
        {cats.map(c => <button key={c} className={`cat-tab${cat===c?" on":""}`} onClick={() => setCat(c)}>{catLabel(c)}</button>)}
        <button className={`cat-tab filter-btn${filtersOpen?" on":""}`} onClick={() => setFiltersOpen(s => !s)}>
          <Icons.Sliders />
          {t('menu_filters')}
          {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
        </button>
      </div>

      <div className="menu-toolbar">
        <div className="menu-search">
          <Icons.Search />
            <input
              className="fi menu-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('menu_search_ph')}
            />
            {norm(query) && (
              <button type="button" className="menu-search-clear" aria-label={t('menu_clear_search')} onClick={() => setQuery('')}>
                <Icons.XIcon />
              </button>
            )}
        </div>

        <div className="menu-stats">
          <div className="menu-stats-chip">
            <Icons.Sparkles /> {filteredSorted.length} / {filteredByCat.length}
          </div>
          {activeCount > 0 && (
            <button type="button" className="menu-stats-reset" onClick={resetAll}>
              <Icons.Refresh /> {t('menu_stats_reset')}
            </button>
          )}
        </div>
      </div>

      {restaurants.length > 0 && (
        <div className="stock-store-bar">
          <div className="stock-store-copy">
            <strong>Наличие по адресу</strong>
            <span>Выберите магазин, чтобы видеть остатки конкретно на этом складе.</span>
          </div>
          <select className="fi stock-store-select" value={stockRestaurantId} onChange={(e) => setStockRestaurantId(e.target.value)}>
            <option value="">Все магазины</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>{r.name} — {r.address}</option>
            ))}
          </select>
        </div>
      )}

      {filtersOpen && (
        <div className="filters-sheet">
          <div className="filters-head">
            <div className="filters-title">
              <Icons.Sliders />
              <strong>{t('menu_filters')}</strong>
              <span className="filters-sub">{t('menu_filters_sub')}</span>
            </div>
            <button type="button" className="filters-close" aria-label={t('menu_close_filters')} onClick={() => setFiltersOpen(false)}>
              <Icons.ChevronUp />
            </button>
          </div>

          <div className="filters-grid">
              <div className="filters-col">
                {INCLUDE_FILTER_GROUPS.map((g) => (
                  <div key={g.titleKey} className="filters-section">
                    <div className="filters-section-title">{t(g.titleKey)}</div>
                    <div className="chip-row">
                      {g.items.map((f) => {
                        const Icon = f.icon;
                        const selected = selectedFilters.has(f.key);
                        const c = includeCount(f.key);
                      return (
                        <button
                          key={f.key}
                          type="button"
                          className={`f-chip${selected ? ' on' : ''}`}
                          onClick={() => toggleInclude(f.key)}
                          aria-pressed={selected}
                        >
                          <span className="f-ico"><Icon /></span>
                          <span className="f-lbl">{t(f.labelKey)}</span>
                          <span className="f-count">{c}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="filters-col">
              <div className="filters-section">
                <div className="filters-section-title">{t('menu_sort')}</div>
                <div className="filters-row">
                  <select className="fi filters-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="smart">{t('menu_sort_reco')}</option>
                    <option value="new_first">{t('menu_sort_new')}</option>
                    <option value="price_asc">{t('menu_sort_price_asc')}</option>
                    <option value="price_desc">{t('menu_sort_price_desc')}</option>
                  </select>
                </div>
              </div>

              <div className="filters-section">
                <div className="filters-section-title">{t('menu_price')}</div>
                <div className="price-row">
                  <div className="price-meta">
                    <span className="price-label">{t('menu_price_up_to')}</span>
                    <span className="price-val">{effectiveMaxPrice || priceBounds.max} ₽</span>
                  </div>
                  <input
                    className="price-range"
                    type="range"
                    min={priceBounds.min || 0}
                    max={priceBounds.max || 0}
                    step="10"
                    value={effectiveMaxPrice || 0}
                    onChange={(e) => {
                      const v = Number(e.target.value || 0);
                      if (!priceBounds.max || v >= priceBounds.max) setMaxPrice(null);
                      else setMaxPrice(v);
                    }}
                    disabled={!priceBounds.max}
                  />
                  <div className="price-minmax">
                    <span>{priceBounds.min} ₽</span>
                    <span>{priceBounds.max} ₽</span>
                  </div>
                </div>
              </div>

              {EXCLUDE_ALLERGENS.length > 0 && (
              <div className="filters-section">
                <div className="filters-section-title">{t('menu_exclude_allergens')}</div>
                <div className="chip-row">
                  {EXCLUDE_ALLERGENS.map((a) => {
                    const Icon = a.icon;
                    const selected = excludedAllergens.has(a.tag);
                    const c = allergenCount(a.tag);
                    return (
                      <button
                        key={a.tag}
                        type="button"
                        className={`f-chip neg${selected ? ' on' : ''}`}
                        onClick={() => toggleAllergen(a.tag)}
                        aria-pressed={selected}
                      >
                        <span className="f-ico"><Icon /></span>
                        <span className="f-lbl">{t('menu_without', { allergen: t(a.labelKey).toLowerCase() })}</span>
                        <span className="f-count">{c}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              )}
            </div>
          </div>

          <div className="filters-footer">
            <button type="button" className="btn btn-ghost" onClick={resetAll}>{t('reset_all')}</button>
            <button type="button" className="btn btn-gold" onClick={() => setFiltersOpen(false)}>{t('done')}</button>
          </div>
        </div>
      )}

      {(selectedFilters.size > 0 || excludedAllergens.size > 0 || norm(query) || maxPrice != null || sort !== 'smart') && (
        <div className="active-bar">
          <div className="active-bar-label"><Icons.Sparkles /> {t('menu_active')}</div>
          <div className="active-bar-chips">
            {norm(query) && (
              <button type="button" className="a-chip" onClick={() => setQuery('')}>
                <Icons.Search />
                «{query.trim()}»
                <span className="a-x">×</span>
              </button>
            )}
            {sort !== 'smart' && (
              <button type="button" className="a-chip" onClick={() => setSort('smart')}>
                <Icons.ArrowUpDown />
                {sort === 'new_first' ? t('menu_sort_chip_new') : sort === 'price_asc' ? t('menu_sort_chip_price_up') : t('menu_sort_chip_price_down')}
                <span className="a-x">×</span>
              </button>
            )}
            {maxPrice != null && (
              <button type="button" className="a-chip" onClick={() => setMaxPrice(null)}>
                <Icons.Coins />
                {t('menu_price_chip', { price: effectiveMaxPrice })}
                <span className="a-x">×</span>
              </button>
            )}
            {Array.from(selectedFilters).map((k) => {
              const f = INCLUDE_BY_KEY.get(k);
              if (!f) return null;
              const Icon = f.icon;
              return (
                <button key={k} type="button" className="a-chip" onClick={() => toggleInclude(k)}>
                  <Icon />
                  {t(f.labelKey)}
                  <span className="a-x">×</span>
                </button>
              );
            })}
            {Array.from(excludedAllergens).map((tag) => {
              const a = ALLERGEN_BY_TAG.get(tag);
              if (!a) return null;
              const Icon = a.icon;
              return (
                <button key={tag} type="button" className="a-chip neg" onClick={() => toggleAllergen(tag)}>
                  <Icon />
                  {t('menu_without', { allergen: t(a.labelKey).toLowerCase() })}
                  <span className="a-x">×</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {filteredSorted.length === 0 && (
        <div className="active-bar" style={{ justifyContent: 'center', padding: '28px 22px' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="page-sub" style={{ margin: 0 }}>Ничего не найдено</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>Попробуйте сбросить фильтры или выбрать другую категорию.</div>
          </div>
        </div>
      )}

      <div className="menu-grid">
        {pageItems.map(dish => {
          const basePrice = Number(dish?.price || 0);
          const disc = clampPercent(dish?.discount_percent || 0);
          const fp = effectivePrice(dish);
          const cartItem = cart.find(i => i.id === dish.id);
          const inCartQty = cartItem ? cartItem.qty : 0;
          const stockQty = stockFor(dish);
          const outOfStock = stockRestaurantId && stockQty <= 0;
          return (
          <div className={`menu-card${outOfStock ? ' out-of-stock' : ''}`} key={dish.id}>
            <div className="mc-img" onClick={() => setSelected(dish)}>
              <img src={dish.img} alt={dish.name} loading="lazy"/>
              {dish.badge && <div className="mc-badge">{dish.badge}</div>}
              {inCartQty > 0 && <div className="mc-cart-badge">{inCartQty}</div>}
              <button
                type="button"
                className={`mc-fav-btn${isFavorite(dish.id) ? ' on' : ''}`}
                aria-label={isFavorite(dish.id) ? 'Убрать из избранного' : 'Добавить в избранное'}
                onClick={(e) => { e.stopPropagation(); toggleFav(dish.id); }}
              >
                {isFavorite(dish.id) ? '♥' : '♡'}
              </button>
            </div>
            <div className="mc-body">
              <div className="mc-tags">
                {(Array.isArray(dish.tags) ? dish.tags : []).map(tag => <span key={tag} className={`tag-chip ${tag}`}>{tag}</span>)}
              </div>
              <div className="mc-name">{dish.name}</div>
              <div className="mc-desc">{dish.desc}</div>
              <div className={`mc-stock ${stockQty <= 0 ? 'out' : stockQty <= 5 ? 'low' : 'ok'}`}>
                {stockQty <= 0 ? 'Нет в наличии' : `В наличии: ${stockQty}`}
              </div>
              <div className="mc-footer">
                <div className="mc-price">
                  {disc > 0 ? (
                    <div className="mc-price-stack">
                      <div className="mc-price-now">{fp}<span> ₽</span></div>
                      <div className="mc-price-meta">
                        <span className="mc-price-was">{basePrice} ₽</span>
                        <span className="mc-price-disc">-{disc}%</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {basePrice}<span> ₽</span>
                    </>
                  )}
                </div>
                {inCartQty > 0 ? (
                  <>
                  <div className="mc-qty-ctrl">
                    <button className="mc-qty-btn" onClick={() => onQty ? (inCartQty === 1 ? onRemove(dish.id) : onQty(dish.id, -1)) : null} aria-label={t('qty_decrease')}>
                      <Icons.Minus />
                    </button>
                    <span className="mc-qty-val">{inCartQty}</span>
                    <button className="mc-qty-btn" onClick={() => onQty ? onQty(dish.id, +1) : handleAdd(dish)} aria-label={t('qty_increase')}>
                      <Icons.Plus />
                    </button>
                  </div>
                  <button type="button" className="mc-cart-link" onClick={onOpenCart}>
                    <Icons.Cart /> {t('cart')}
                  </button>
                  </>
                ) : (
                  <button className={`add-btn${added.has(dish.id) ? " added" : ""}`} onClick={() => handleAdd(dish)} disabled={outOfStock}>
                    {added.has(dish.id) ? <><Icons.Check /> {t('added')}</> : <><Icons.Plus /> {t('to_cart')}</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
        })}
      </div>
      {filteredSorted.length > PAGE_SIZE && (
        <div className="menu-pagination" aria-label="Страницы каталога">
          <button type="button" className="page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            <Icons.ChL /> {t('back')}
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={`page-num${n === page ? ' on' : ''}`}
              onClick={() => setPage(n)}
              aria-current={n === page ? 'page' : undefined}
            >
              {n}
            </button>
          ))}
          <button type="button" className="page-btn" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount}>
            Далее <Icons.ChR />
          </button>
        </div>
      )}
      {selected && <DishModal dish={selected} onClose={() => setSelected(null)} onAdd={handleAdd} toast={toast}/>}
    </div>
  );
}
