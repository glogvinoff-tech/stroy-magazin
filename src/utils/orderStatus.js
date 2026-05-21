export const ORDER_STATUS_FLOW = ['pending', 'confirmed', 'cooking', 'ready', 'delivered'];

export const ORDER_STATUS_LABELS = {
  pending:   'Принято',
  confirmed: 'Подтверждён',
  cooking:   'Готовится',
  ready:     'Готов',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

export const ORDER_STATUS_EMOJI = {
  pending:   '🕐',
  confirmed: '✅',
  cooking:   '👨‍🍳',
  ready:     '🛍',
  delivered: '🎉',
  cancelled: '❌',
};

export const ORDER_STATUS_CLS = {
  pending:   'wait',
  confirmed: 'ok',
  cooking:   'wait',
  ready:     'ok',
  delivered: 'ok',
  cancelled: 'bad',
};

const STORAGE_KEY = 'order_statuses';

export function getAllOrderStatuses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function getOrderStatus(orderId) {
  return getAllOrderStatuses()[String(orderId)] || 'pending';
}

export function setOrderStatus(orderId, status) {
  const all = getAllOrderStatuses();
  all[String(orderId)] = status;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  // Notify other tabs / components
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
}
