const API_BASE = (process.env.REACT_APP_API_BASE || '/api').replace(/\/+$/, '');

const UI_LANG_KEY = 'ui_lang';

function getUiLang() {
  if (typeof window === 'undefined') return 'ru';
  try {
    const v = window.localStorage.getItem(UI_LANG_KEY);
    return v === 'en' || v === 'zh' || v === 'ru' ? v : 'ru';
  } catch {
    return 'ru';
  }
}

function tr(msgByLang) {
  const lang = getUiLang();
  return msgByLang?.[lang] || msgByLang?.ru || '';
}

const ERR_MIXED_CONTENT = {
  ru: 'Браузер блокирует запрос: страница открыта по HTTPS, а API по HTTP (mixed content). Для локального теста откройте фронт локально (`npm start`) или поднимите HTTPS-туннель для API и укажите его в REACT_APP_API_BASE.',
  en: 'The browser blocked the request: the page is opened via HTTPS, but the API is HTTP (mixed content). For local testing, run the frontend locally (`npm start`) or use an HTTPS tunnel for the API and set it in REACT_APP_API_BASE.',
  zh: '浏览器已阻止请求：页面通过 HTTPS 打开，但 API 使用 HTTP（mixed content）。本地测试请在本地启动前端（`npm start`），或为 API 建立 HTTPS 隧道并在 REACT_APP_API_BASE 中指定。',
};

const ERR_UNREACHABLE = {
  ru: 'Не удалось подключиться к серверу. Проверьте, что бэкенд запущен и REACT_APP_API_BASE указывает на правильный адрес.',
  en: 'Could not connect to the server. Make sure the backend is running and REACT_APP_API_BASE points to the correct address.',
  zh: '无法连接到服务器。请确认后端已启动，并且 REACT_APP_API_BASE 指向正确地址。',
};

async function requestJson(path, options = {}) {
  const { method = 'GET', body, headers = {} } = options;
  const init = {
    method,
    headers: {
      ...headers,
    },
  };

  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    if (typeof window !== 'undefined') {
      const pageProto = window.location?.protocol || '';
      if (pageProto === 'https:' && /^http:\/\//i.test(API_BASE)) {
        throw new Error(tr(ERR_MIXED_CONTENT));
      }
    }
    throw new Error(tr(ERR_UNREACHABLE));
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const detail = (payload && (payload.detail || payload.message)) || res.statusText || 'Request failed';
    throw new Error(detail);
  }

  return payload;
}

async function uploadForm(path, formData) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      body: formData,
    });
  } catch {
    throw new Error(tr(ERR_UNREACHABLE));
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const detail = (payload && (payload.detail || payload.message)) || res.statusText || 'Upload failed';
    throw new Error(detail);
  }

  return payload;
}

export const api = {
  auth: {
    getPublicConfig: async () => {
      return requestJson('/auth/public-config');
    },

    register: async (name, password, roleId = 1, email = undefined) => {
      return requestJson('/auth/register', {
        method: 'POST',
        body: {
          name,
          password,
          role_id: roleId,
          email,
        },
      });
    },

    login: async (name, password) => {
      return requestJson('/auth/login', {
        method: 'POST',
        body: { name, password },
      });
    },

    loginWithGoogle: async (code) => {
      return requestJson('/auth/google/callback', {
        method: 'POST',
        body: { code },
      });
    },

    loginWithVk: async (code, redirectUri) => {
      return requestJson('/auth/vk/callback', {
        method: 'POST',
        body: { code, redirect_uri: redirectUri },
      });
    },

    loginWithVkid: async (accessToken, userId, email = undefined) => {
      return requestJson('/auth/vkid/login', {
        method: 'POST',
        body: { access_token: accessToken, user_id: String(userId || ''), email },
      });
    },

    loginWithTelegram: async (telegramAuthData) => {
      return requestJson('/auth/telegram/callback', {
        method: 'POST',
        body: telegramAuthData,
      });
    },

    linkTelegram: async (userId, telegramAuthData) => {
      return requestJson('/auth/telegram/link', {
        method: 'POST',
        body: { user_id: userId, ...telegramAuthData },
      });
    },

    linkVk: async (userId, code, redirectUri) => {
      return requestJson('/auth/vk/link', {
        method: 'POST',
        body: { user_id: userId, code, redirect_uri: redirectUri },
      });
    },

    getUser: async (userId) => {
      return requestJson(`/auth/users/${userId}`);
    },

    getProfile: async (userId) => {
      return requestJson(`/auth/users/${userId}/profile`);
    },

    updateProfile: async (userId, data) => {
      return requestJson(`/auth/users/${userId}/profile`, {
        method: 'PUT',
        body: data,
      });
    },

    sendEmailCode: async (userId, email) => {
      return requestJson('/auth/email/send-code', {
        method: 'POST',
        body: { user_id: userId, email },
      });
    },

    confirmEmailCode: async (userId, code) => {
      return requestJson('/auth/email/confirm', {
        method: 'POST',
        body: { user_id: userId, code },
      });
    },

    setProStatus: async (userId, enabled) => {
      return requestJson(`/auth/users/${userId}/pro`, {
        method: 'POST',
        body: { enabled: Boolean(enabled) },
      });
    },
  },

  ai: {
    supportReply: async (threadId, userId, temperature = null) => {
      return requestJson(`/ai/support/thread/${threadId}/reply?user_id=${encodeURIComponent(String(userId || ''))}`, {
        method: 'POST',
        body: temperature !== null && temperature !== undefined ? { temperature } : {},
      });
    },

    adminReply: async (threadId, adminId, temperature = null) => {
      return requestJson(`/ai/admin/thread/${threadId}/reply?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
        method: 'POST',
        body: temperature !== null && temperature !== undefined ? { temperature } : {},
      });
    },
  },

  support: {
    getThread: async (userId) => {
      return requestJson(`/support/thread?user_id=${encodeURIComponent(String(userId || ''))}`);
    },

    listMessages: async (threadId, userId) => {
      return requestJson(`/support/thread/${threadId}/messages?user_id=${encodeURIComponent(String(userId || ''))}`);
    },

    sendMessage: async (threadId, userId, text) => {
      return requestJson(`/support/thread/${threadId}/messages?user_id=${encodeURIComponent(String(userId || ''))}`, {
        method: 'POST',
        body: { text },
      });
    },

    adminListThreads: async (adminId) => {
      return requestJson(`/support/admin/threads?admin_id=${encodeURIComponent(String(adminId || ''))}`);
    },

    adminListMessages: async (threadId, adminId) => {
      return requestJson(`/support/admin/threads/${threadId}/messages?admin_id=${encodeURIComponent(String(adminId || ''))}`);
    },

    adminSendMessage: async (threadId, adminId, text) => {
      return requestJson(`/support/admin/threads/${threadId}/messages?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
        method: 'POST',
        body: { text },
      });
    },
  },

  menu: {
    list: async () => {
      return requestJson('/menu/items');
    },

    cats: async () => {
      return requestJson('/menu/cats');
    },

    adminList: async (adminId) => {
      return requestJson(`/menu/items?include_inactive=1&admin_id=${encodeURIComponent(String(adminId || ''))}`);
    },

    adminCreate: async (adminId, payload) => {
      return requestJson(`/menu/items?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
        method: 'POST',
        body: payload,
      });
    },

    adminUpdate: async (adminId, itemId, payload) => {
      return requestJson(`/menu/items/${itemId}?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
        method: 'PUT',
        body: payload,
      });
    },

    adminDelete: async (adminId, itemId) => {
      return requestJson(`/menu/items/${itemId}?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
        method: 'DELETE',
      });
    },
  },

  events: {
    list: async (userId = null, past = false) => {
      const params = new URLSearchParams();
      if (userId) params.set('user_id', String(userId));
      if (past) params.set('past', '1');
      const qp = params.toString() ? `?${params.toString()}` : '';
      return requestJson(`/events/${qp}`);
    },

    adminCreate: async (adminId, payload) => {
      return requestJson(`/events/?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
        method: 'POST',
        body: payload,
      });
    },

    adminUpdate: async (adminId, eventId, payload) => {
      return requestJson(`/events/${eventId}?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
        method: 'PUT',
        body: payload,
      });
    },

    adminDelete: async (adminId, eventId) => {
      return requestJson(`/events/${eventId}?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
        method: 'DELETE',
      });
    },
  },

  orders: {
    create: async (userId, payload) => {
      const qp = userId ? `?user_id=${encodeURIComponent(String(userId))}` : '';
      return requestJson(`/orders${qp}`, {
        method: 'POST',
        body: payload,
      });
    },

    listUser: async (userId) => {
      return requestJson(`/orders?user_id=${encodeURIComponent(String(userId || ''))}`);
    },
  },

  admin: {
    orders: {
      list: async (adminId) => {
        return requestJson(`/admin/orders/?admin_id=${encodeURIComponent(String(adminId || ''))}`);
      },

      updateStatus: async (adminId, orderId, status) => {
        return requestJson(`/admin/orders/${orderId}/status?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
          method: 'PUT',
          body: { status },
        });
      },
    },
    tables: {
      setBlocked: async (adminId, tableId, blocked) => {
        return requestJson(`/admin/tables/${tableId}?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
          method: 'PUT',
          body: { is_blocked: Boolean(blocked) },
        });
      },

      setLayout: async (adminId, tableId, x, y) => {
        return requestJson(`/admin/tables/${tableId}/layout?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
          method: 'PUT',
          body: { x: Number(x), y: Number(y) },
        });
      },

      setMeta: async (adminId, tableId, payload) => {
        return requestJson(`/admin/tables/${tableId}/meta?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
          method: 'PUT',
          body: payload,
        });
      },

      create: async (adminId, payload) => {
        return requestJson(`/admin/tables?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
          method: 'POST',
          body: payload,
        });
      },

      remove: async (adminId, tableId) => {
        return requestJson(`/admin/tables/${tableId}?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
          method: 'DELETE',
        });
      },

      removeAllForRestaurant: async (adminId, restaurantId) => {
        return requestJson(`/admin/restaurants/${restaurantId}/tables?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
          method: 'DELETE',
        });
      },
    },
  },

  restaurants: {
    list: async () => {
      return requestJson('/restaurants/');
    },

    adminCreate: async (adminId, payload) => {
      return requestJson(`/restaurants/?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
        method: 'POST',
        body: payload,
      });
    },

    adminUpdate: async (adminId, restaurantId, payload) => {
      return requestJson(`/restaurants/${restaurantId}?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
        method: 'PUT',
        body: payload,
      });
    },

    adminDelete: async (adminId, restaurantId) => {
      return requestJson(`/restaurants/${restaurantId}?admin_id=${encodeURIComponent(String(adminId || ''))}`, {
        method: 'DELETE',
      });
    },

    tables: async (restaurantId) => {
      return requestJson(`/restaurants/${restaurantId}/tables`);
    },
  },

  uploads: {
    image: async (adminId, file, prefix = 'admin') => {
      const formData = new FormData();
      formData.append('admin_id', String(adminId || ''));
      formData.append('prefix', prefix);
      formData.append('file', file);
      return uploadForm('/uploads/image', formData);
    },
  },

  reviews: {
    list: async (featuredOnly = false, itemId = null) => {
      const params = new URLSearchParams();
      if (featuredOnly) params.set('featured_only', '1');
      if (itemId != null) params.set('item_id', String(itemId));
      const qp = params.toString() ? `?${params.toString()}` : '';
      return requestJson(`/reviews/${qp}`);
    },

    create: async (payload, userId = null) => {
      const qp = userId ? `?user_id=${encodeURIComponent(String(userId))}` : '';
      return requestJson(`/reviews/${qp}`, {
        method: 'POST',
        body: payload,
      });
    },

    adminReply: async (adminId, reviewId, reply) => {
      return requestJson(`/reviews/${reviewId}/reply?admin_id=${encodeURIComponent(String(adminId))}`, {
        method: 'PUT',
        body: { admin_reply: reply },
      });
    },

    adminFeature: async (adminId, reviewId, isFeatured) => {
      return requestJson(`/reviews/${reviewId}/feature?admin_id=${encodeURIComponent(String(adminId))}`, {
        method: 'PUT',
        body: { is_featured: isFeatured },
      });
    },

    adminDelete: async (adminId, reviewId) => {
      return requestJson(`/reviews/${reviewId}?admin_id=${encodeURIComponent(String(adminId))}`, {
        method: 'DELETE',
      });
    },
  },
};
