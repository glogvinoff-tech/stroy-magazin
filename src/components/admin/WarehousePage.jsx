import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { Icons } from '../icons/Icons';
import './admin.css';

const stockKey = (row) => `${row.menu_item_id}:${row.restaurant_id}`;

export function WarehousePage({ toast, setPage }) {
  const { user } = useAuth();
  const adminId = user?.id;
  const isAdmin = Number(user?.role_id) === 2;
  const [restaurants, setRestaurants] = useState([]);
  const [rows, setRows] = useState([]);
  const [movements, setMovements] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [restaurantId, setRestaurantId] = useState('');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [historyItemId, setHistoryItemId] = useState('');
  const [docForm, setDocForm] = useState({
    kind: 'receipt',
    menu_item_id: '',
    restaurant_id: '',
    quantity: '',
    document_no: '',
    comment: '',
  });

  const visibleRows = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    return rows.filter((row) => {
      if (restaurantId && Number(row.restaurant_id) !== Number(restaurantId)) return false;
      if (!q) return true;
      const hay = `${row?.item?.name || ''} ${row?.item?.cat || ''} ${row?.sku || ''} ${row?.barcode || ''} ${row?.data_matrix || ''} ${row?.batch || ''} ${row?.supplier || ''} ${row?.location || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, restaurantId, rows]);

  const stats = useMemo(() => {
    const soon = Date.now() + 45 * 24 * 60 * 60 * 1000;
    return visibleRows.reduce((acc, row) => {
      acc.total += Number(row.available || 0);
      acc.value += Number(row.available || 0) * Number(row?.item?.price || 0);
      if (row.status === 'low') acc.low += 1;
      if (row.status === 'out') acc.out += 1;
      const exp = row.expires_at ? new Date(row.expires_at).getTime() : 0;
      if (Number.isFinite(exp) && exp > 0 && exp <= soon) acc.expiring += 1;
      return acc;
    }, { total: 0, value: 0, low: 0, out: 0, expiring: 0 });
  }, [visibleRows]);

  const reorderRows = useMemo(() => {
    return visibleRows
      .map((row) => ({ ...row, reorder_qty: Math.max(0, Number(row.min_quantity || 0) - Number(row.available || 0)) }))
      .filter((row) => row.reorder_qty > 0)
      .sort((a, b) => b.reorder_qty - a.reorder_qty);
  }, [visibleRows]);

  const historyRows = useMemo(() => {
    if (!historyItemId) return movements;
    return movements.filter((m) => Number(m.menu_item_id) === Number(historyItemId));
  }, [historyItemId, movements]);

  const load = async () => {
    if (!adminId || !isAdmin) return;
    setLoading(true);
    try {
      const [storeList, stockList, movementList, documentList] = await Promise.all([
        api.restaurants.list(),
        api.warehouse.list(adminId),
        api.warehouse.movements(adminId),
        api.warehouse.documents(adminId),
      ]);
      const safeRows = Array.isArray(stockList) ? stockList : [];
      setRestaurants(Array.isArray(storeList) ? storeList : []);
      setRows(safeRows);
      setMovements(Array.isArray(movementList) ? movementList : []);
      setDocuments(Array.isArray(documentList) ? documentList : []);
      setDraft(Object.fromEntries(safeRows.map((row) => [
        stockKey(row),
        {
          quantity: String(row.quantity ?? 0),
          min_quantity: String(row.min_quantity ?? 0),
          sku: row.sku || '',
          barcode: row.barcode || '',
          data_matrix: row.data_matrix || '',
          batch: row.batch || '',
          location: row.location || '',
          storage_condition: row.storage_condition || '',
          supplier: row.supplier || '',
          expires_at: row.expires_at || '',
        },
      ])));
    } catch (e) {
      toast?.err?.(e.message || 'Не удалось загрузить склад');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId, isAdmin]);

  const patchDraft = (row, patch) => {
    const key = stockKey(row);
    setDraft((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));
  };

  const saveRow = async (row) => {
    const key = stockKey(row);
    const d = draft[key] || {};
    setBusyKey(key);
    try {
      await api.warehouse.update(adminId, row.menu_item_id, row.restaurant_id, {
        quantity: Number(d.quantity || 0),
        min_quantity: Number(d.min_quantity || 0),
        sku: d.sku || '',
        barcode: d.barcode || '',
        data_matrix: d.data_matrix || '',
        batch: d.batch || '',
        location: d.location || '',
        storage_condition: d.storage_condition || '',
        supplier: d.supplier || '',
        expires_at: d.expires_at || '',
      });
      await load();
      toast?.ok?.('Остатки сохранены');
    } catch (e) {
      toast?.err?.(e.message || 'Не удалось сохранить остатки');
    } finally {
      setBusyKey('');
    }
  };

  const adjustRow = async (row, delta) => {
    const key = stockKey(row);
    setBusyKey(key);
    try {
      await api.warehouse.adjust(adminId, row.menu_item_id, row.restaurant_id, delta, delta > 0 ? 'Приход' : 'Списание');
      await load();
    } catch (e) {
      toast?.err?.(e.message || 'Не удалось изменить остаток');
    } finally {
      setBusyKey('');
    }
  };

  const clearRow = async (row) => {
    const key = stockKey(row);
    setBusyKey(key);
    try {
      await api.warehouse.clear(adminId, row.menu_item_id, row.restaurant_id);
      await load();
      toast?.ok?.('Остаток обнулён');
    } catch (e) {
      toast?.err?.(e.message || 'Не удалось обнулить остаток');
    } finally {
      setBusyKey('');
    }
  };

  const createDocument = async () => {
    if (!docForm.menu_item_id || !docForm.restaurant_id) {
      toast?.err?.('Выберите товар и адрес для документа');
      return;
    }
    const qty = Math.max(0, Math.floor(Number(docForm.quantity || 0)));
    if (qty <= 0 && docForm.kind !== 'inventory') {
      toast?.err?.('Укажите количество');
      return;
    }
    setBusyKey('document');
    try {
      await api.warehouse.createDocument(adminId, {
        kind: docForm.kind,
        menu_item_id: Number(docForm.menu_item_id),
        restaurant_id: Number(docForm.restaurant_id),
        quantity: qty,
        document_no: docForm.document_no,
        comment: docForm.comment,
      });
      setDocForm((p) => ({ ...p, quantity: '', document_no: '', comment: '' }));
      await load();
      toast?.ok?.('Складской документ проведён');
    } catch (e) {
      toast?.err?.(e.message || 'Не удалось провести документ');
    } finally {
      setBusyKey('');
    }
  };

  const exportCsv = async () => {
    try {
      const blob = await api.warehouse.exportCsv(adminId, restaurantId || null);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'warehouse-stock.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast?.err?.(e.message || 'Не удалось экспортировать склад');
    }
  };

  if (!isAdmin) {
    return (
      <div className="page warehouse-full-page">
        <div className="admin-empty-state">
          <div className="admin-stub-h">Доступ только для администратора</div>
          <div className="admin-muted">Войдите под админ-аккаунтом, чтобы открыть складской учёт.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page warehouse-full-page">
      <div className="warehouse-full-head">
        <div>
          <div className="page-title">Складской <em>учёт</em></div>
          <div className="page-sub">Остатки стройматериалов по магазинам, партиям, маркировке и местам хранения.</div>
        </div>
        <div className="warehouse-full-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setPage?.('home')}>
            <Icons.ArrowLeft /> На главную
          </button>
          <button type="button" className="btn btn-outline-gold" onClick={exportCsv}>
            <Icons.PDF /> CSV / Excel
          </button>
          <button type="button" className="btn btn-gold" onClick={load} disabled={loading}>
            <Icons.Refresh /> Обновить
          </button>
        </div>
      </div>

      <div className="warehouse-kpis">
        <div className="warehouse-kpi"><span>Доступно единиц</span><strong>{stats.total}</strong></div>
        <div className="warehouse-kpi"><span>Стоимость остатков</span><strong>{stats.value.toLocaleString('ru-RU')} ₽</strong></div>
        <div className="warehouse-kpi warn"><span>Заканчивается</span><strong>{stats.low}</strong></div>
        <div className="warehouse-kpi danger"><span>Нет в наличии</span><strong>{stats.out}</strong></div>
        <div className="warehouse-kpi warn"><span>Срок до 45 дней</span><strong>{stats.expiring}</strong></div>
      </div>

      <div className="warehouse-toolbar">
        <select className="fi" value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
          <option value="">Все адреса</option>
          {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.address}</option>)}
        </select>
        <input className="fi" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск: товар, артикул, штрихкод, Data Matrix, партия, поставщик" />
      </div>

      <div className="warehouse-doc-panel">
        <div className="warehouse-doc-head">
          <div>
            <strong>Складские документы</strong>
            <span>Приходная накладная, списание и инвентаризация проводят остатки и пишут движение в журнал.</span>
          </div>
        </div>
        <div className="warehouse-doc-form">
          <select className="fi" value={docForm.kind} onChange={(e) => setDocForm((p) => ({ ...p, kind: e.target.value }))}>
            <option value="receipt">Приходная накладная</option>
            <option value="writeoff">Списание</option>
            <option value="inventory">Инвентаризация</option>
          </select>
          <select className="fi" value={docForm.menu_item_id} onChange={(e) => setDocForm((p) => ({ ...p, menu_item_id: e.target.value }))}>
            <option value="">Товар</option>
            {Array.from(new Map(rows.map((r) => [r.menu_item_id, r.item])).entries()).map(([id, item]) => (
              <option key={id} value={id}>{item?.name}</option>
            ))}
          </select>
          <select className="fi" value={docForm.restaurant_id} onChange={(e) => setDocForm((p) => ({ ...p, restaurant_id: e.target.value }))}>
            <option value="">Адрес</option>
            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.address}</option>)}
          </select>
          <input className="fi" type="number" min="0" value={docForm.quantity} onChange={(e) => setDocForm((p) => ({ ...p, quantity: e.target.value }))} placeholder={docForm.kind === 'inventory' ? 'Новый остаток' : 'Количество'} />
          <input className="fi" value={docForm.document_no} onChange={(e) => setDocForm((p) => ({ ...p, document_no: e.target.value }))} placeholder="Номер документа" />
          <input className="fi" value={docForm.comment} onChange={(e) => setDocForm((p) => ({ ...p, comment: e.target.value }))} placeholder="Комментарий" />
          <button type="button" className="btn btn-gold" onClick={createDocument} disabled={busyKey === 'document'}>
            Провести
          </button>
        </div>
      </div>

      {reorderRows.length > 0 && (
        <div className="warehouse-reorder">
          <div className="warehouse-doc-head">
            <div>
              <strong>Нужно закупить</strong>
              <span>Автоматический расчёт до минимального остатка по выбранному адресу и фильтрам.</span>
            </div>
          </div>
          <div className="warehouse-reorder-list">
            {reorderRows.slice(0, 8).map((row) => (
              <button
                key={`${row.menu_item_id}:${row.restaurant_id}`}
                type="button"
                className="warehouse-reorder-chip"
                onClick={() => {
                  setDocForm((p) => ({
                    ...p,
                    kind: 'receipt',
                    menu_item_id: String(row.menu_item_id),
                    restaurant_id: String(row.restaurant_id),
                    quantity: String(row.reorder_qty),
                    comment: 'Закупка до минимального остатка',
                  }));
                }}
              >
                <strong>{row.item?.name}</strong>
                <span>{row.restaurant?.address}</span>
                <em>докупить {row.reorder_qty}</em>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="warehouse-table-wrap">
        {loading && <div className="admin-muted" style={{ padding: 16 }}>Загрузка склада...</div>}
        {!loading && visibleRows.length === 0 && (
          <div className="admin-empty-state">
            <div className="admin-stub-h">Нет строк склада</div>
            <div className="admin-muted">Добавьте товары и магазины в админ-панели.</div>
          </div>
        )}
        {!loading && visibleRows.length > 0 && (
          <div className="warehouse-table">
            <div className="warehouse-head">
              <span>Товар</span><span>Адрес</span><span>Остаток</span><span>Мин.</span><span>Маркировка / хранение / поставщик</span><span>Действия</span>
            </div>
            {visibleRows.map((row) => {
              const key = stockKey(row);
              const d = draft[key] || {};
              const busy = busyKey === key;
              return (
                <div key={key} className={`warehouse-row ${row.status}`}>
                  <div className="warehouse-product"><strong>{row.item?.name}</strong><span>{row.item?.cat} · {row.item?.price || 0} ₽</span></div>
                  <div className="warehouse-address"><strong>{row.restaurant?.name}</strong><span>{row.restaurant?.address}</span></div>
                  <input className="fi warehouse-num" type="number" min="0" value={d.quantity ?? ''} onChange={(e) => patchDraft(row, { quantity: e.target.value })} />
                  <input className="fi warehouse-num" type="number" min="0" value={d.min_quantity ?? ''} onChange={(e) => patchDraft(row, { min_quantity: e.target.value })} />
                  <div className="warehouse-meta">
                    <input className="fi" value={d.sku ?? ''} onChange={(e) => patchDraft(row, { sku: e.target.value })} placeholder="Артикул" />
                    <input className="fi" value={d.barcode ?? ''} onChange={(e) => patchDraft(row, { barcode: e.target.value })} placeholder="Штрихкод" />
                    <input className="fi" value={d.data_matrix ?? ''} onChange={(e) => patchDraft(row, { data_matrix: e.target.value })} placeholder="Data Matrix" />
                    <input className="fi" value={d.batch ?? ''} onChange={(e) => patchDraft(row, { batch: e.target.value })} placeholder="Партия" />
                    <input className="fi" value={d.location ?? ''} onChange={(e) => patchDraft(row, { location: e.target.value })} placeholder="Стеллаж / зона" />
                    <input className="fi" value={d.storage_condition ?? ''} onChange={(e) => patchDraft(row, { storage_condition: e.target.value })} placeholder="Условия хранения" />
                    <input className="fi" value={d.supplier ?? ''} onChange={(e) => patchDraft(row, { supplier: e.target.value })} placeholder="Поставщик" />
                    <input className="fi" type="date" value={d.expires_at ?? ''} onChange={(e) => patchDraft(row, { expires_at: e.target.value })} title="Срок годности" />
                  </div>
                  <div className="warehouse-actions">
                    <span className={`warehouse-status ${row.status}`}>{row.status_label}</span>
                    <span className="warehouse-status">Резерв: {Number(row.reserved || 0)}</span>
                    <span className={Math.max(0, Number(row.min_quantity || 0) - Number(row.available || 0)) > 0 ? 'warehouse-status low' : 'warehouse-status ok'}>
                      Докупить: {Math.max(0, Number(row.min_quantity || 0) - Number(row.available || 0))}
                    </span>
                    <div className="warehouse-action-row">
                      <button type="button" className="btn btn-ghost" onClick={() => adjustRow(row, -1)} disabled={busy || Number(row.quantity || 0) <= 0}>-1</button>
                      <button type="button" className="btn btn-ghost" onClick={() => adjustRow(row, 1)} disabled={busy}>+1</button>
                      <button type="button" className="btn btn-outline-gold" onClick={() => clearRow(row)} disabled={busy}>Обнулить</button>
                      <button type="button" className="btn btn-gold" onClick={() => saveRow(row)} disabled={busy}>Сохранить</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="warehouse-movements">
        <div className="admin-panel-h">
          <div className="admin-panel-title">История по товару и журнал движений</div>
          <select className="fi warehouse-history-select" value={historyItemId} onChange={(e) => setHistoryItemId(e.target.value)}>
            <option value="">Все товары</option>
            {Array.from(new Map(rows.map((r) => [r.menu_item_id, r.item])).entries()).map(([id, item]) => (
              <option key={id} value={id}>{item?.name}</option>
            ))}
          </select>
        </div>
        {historyRows.length === 0 ? <div className="admin-muted">Движений пока нет.</div> : historyRows.slice(0, 20).map((m) => (
          <div key={m.id} className="warehouse-movement">
            <strong>{m.delta > 0 ? '+' : ''}{m.delta}</strong>
            <span>{m.item_name || `Товар #${m.menu_item_id}`}</span>
            <em>{m.reason || 'Операция'} · остаток {m.quantity_after}</em>
          </div>
        ))}
      </div>

      <div className="warehouse-movements">
        <div className="admin-panel-h"><div className="admin-panel-title">Последние документы</div></div>
        {documents.length === 0 ? <div className="admin-muted">Документов пока нет.</div> : documents.slice(0, 12).map((d) => (
          <div key={d.id} className="warehouse-movement">
            <strong>{d.kind === 'receipt' ? 'Приход' : d.kind === 'writeoff' ? 'Списание' : 'Инв.'}</strong>
            <span>{d.item_name || `Товар #${d.menu_item_id}`}</span>
            <em>#{d.document_no || d.id} · {d.quantity_before} → {d.quantity_after}</em>
          </div>
        ))}
      </div>
    </div>
  );
}
