/**
 * DOQ shared browser client (loaded by every web page and every mobile /m page).
 * - CSRF-aware fetch wrapper for same-origin state-changing requests.
 * - DOQ.api / DOQ.escape / DOQ.safeImage helpers.
 * - DOQ.toast floating messages with sound.
 * - Global notification polling: every signed-in user (admin, chef, delivery, customer)
 *   gets a floating toast + sound on ANY page as soon as a new notification arrives.
 */
(() => {
  'use strict';
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

  // ============================================
  // CSRF-aware fetch
  // ============================================
  const nativeFetch = window.fetch.bind(window);
  let tokenPromise;
  async function csrf() {
    if (!tokenPromise) tokenPromise = nativeFetch('/security/csrf', { credentials: 'same-origin', cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('csrf_unavailable'); return r.json(); })
      .then(data => data.token).catch(error => { tokenPromise = null; throw error; });
    return tokenPromise;
  }
  window.fetch = async (input, options = {}) => {
    const request = new Request(input instanceof Request ? input : new URL(input, location.href), options);
    if (new URL(request.url).origin === location.origin && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const headers = new Headers(request.headers);
      headers.set('x-csrf-token', await csrf());
      const response = await nativeFetch(new Request(request, { headers, credentials: 'same-origin' }));
      if (response.status === 403 || request.url.includes('/auth/')) tokenPromise = null;
      return response;
    }
    return nativeFetch(request);
  };

  // ============================================
  // Helpers
  // ============================================
  const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ENTITIES[ch]);

  function safeImage(value) {
    try {
      const url = new URL(String(value || ''), location.origin);
      return url.protocol === 'https:' || url.origin === location.origin ? escape(url.href) : '';
    } catch { return ''; }
  }

  async function api(url, method, body, extraHeaders) {
    method = method || 'GET';
    const response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(extraHeaders || {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    let data = {};
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) {
      const error = new Error(data.message || 'حصل خطأ. حاول تاني');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  // ============================================
  // Sound (unlocked on first user gesture because of autoplay rules)
  // ============================================
  const notificationSound = new Audio('/sounds/notification.wav');
  notificationSound.preload = 'auto';
  notificationSound.volume = 0.6;
  let audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    notificationSound.muted = true;
    notificationSound.play().then(() => {
      notificationSound.pause();
      notificationSound.currentTime = 0;
      notificationSound.muted = false;
    }).catch(() => { notificationSound.muted = false; audioUnlocked = false; });
  }
  ['click', 'keydown', 'touchstart'].forEach(evt => document.addEventListener(evt, unlockAudio, { passive: true }));

  let soundEnabled = true;
  function playSound() {
    if (!soundEnabled) return;
    try { if (navigator.vibrate) navigator.vibrate(120); } catch {}
    const sound = notificationSound.cloneNode();
    sound.volume = notificationSound.volume;
    sound.play().catch(() => {});
  }

  // ============================================
  // Toasts
  // ============================================
  const toast = (function () {
    let container = null;
    const colors = {
      info: { bg: '#fff8f6', border: '#e1bfb9', text: '#261816', accent: '#9e2016' },
      success: { bg: '#ecfdf5', border: '#10b981', text: '#065f46', accent: '#059669' },
      error: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', accent: '#dc2626' },
      warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', accent: '#d97706' },
      notification: { bg: '#ffffff', border: '#fc7127', text: '#261816', accent: '#fc7127' }
    };
    function ensureContainer() {
      if (container && document.body.contains(container)) return container;
      container = document.createElement('div');
      container.id = 'doq-toast-container';
      container.setAttribute('aria-live', 'polite');
      container.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top,0px) + 12px);left:50%;transform:translateX(-50%);z-index:2147483000;display:flex;flex-direction:column;gap:8px;pointer-events:none;width:min(92vw,420px);';
      document.body.appendChild(container);
      return container;
    }
    function removeToast(el) {
      if (!el || el.dataset.leaving) return;
      el.dataset.leaving = '1';
      el.style.animation = 'doqToastOut .25s ease forwards';
      setTimeout(() => el.remove(), 250);
    }
    function show(message, options) {
      options = options || {};
      const type = options.type || 'info';
      const style = colors[type] || colors.info;
      const el = document.createElement('div');
      el.setAttribute('role', type === 'error' ? 'alert' : 'status');
      el.style.cssText = 'pointer-events:auto;display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:14px;font:500 14px/1.6 Tajawal,Cairo,system-ui,sans-serif;box-shadow:0 12px 30px rgba(38,24,22,.18);animation:doqToastIn .3s ease forwards;direction:rtl;text-align:right;';
      el.style.background = style.bg;
      el.style.border = '1px solid ' + style.border;
      el.style.borderInlineStart = '4px solid ' + style.accent;
      el.style.color = style.text;

      const text = document.createElement('div');
      text.style.cssText = 'flex:1;min-width:0;';
      if (options.title) {
        const t = document.createElement('strong');
        t.textContent = options.title;
        t.style.cssText = 'display:block;font-weight:800;margin-bottom:2px;';
        text.appendChild(t);
      }
      const body = document.createElement('span');
      body.textContent = message;
      body.style.cssText = 'display:block;white-space:pre-line;overflow-wrap:anywhere;';
      text.appendChild(body);
      el.appendChild(text);

      if (options.href) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', e => { if (!e.target.closest('button')) location.assign(options.href); });
      }
      if (options.action && options.actionText) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = options.actionText;
        btn.style.cssText = 'flex-shrink:0;padding:4px 10px;border-radius:8px;font-weight:700;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer;';
        btn.onclick = () => { removeToast(el); options.action(); };
        el.appendChild(btn);
      }
      const close = document.createElement('button');
      close.type = 'button';
      close.setAttribute('aria-label', 'إغلاق');
      close.textContent = '×';
      close.style.cssText = 'flex-shrink:0;width:28px;height:28px;border:none;border-radius:8px;background:transparent;color:inherit;cursor:pointer;font-size:20px;line-height:1;opacity:.6;';
      close.onclick = () => removeToast(el);
      el.appendChild(close);

      ensureContainer().appendChild(el);
      if (options.sound) playSound();
      setTimeout(() => removeToast(el), options.duration || 4000);
      return el;
    }
    return {
      show,
      info: (m, o) => show(m, { ...o, type: 'info' }),
      success: (m, o) => show(m, { ...o, type: 'success' }),
      error: (m, o) => show(m, { ...o, type: 'error' }),
      warning: (m, o) => show(m, { ...o, type: 'warning' }),
      setSoundEnabled: enabled => { soundEnabled = !!enabled; }
    };
  })();

  // ============================================
  // Global notifications (all roles, all pages)
  // ============================================
  const POLL_INTERVAL = 10000;
  let lastId = null;
  let pollTimer = null;
  let stopped = false;

  function notificationsPage() {
    return window.DOQ_NOTIFICATIONS_URL || (location.pathname.startsWith('/m') ? '/m/notifications' : '/notifications');
  }

  function updateBadge(count) {
    const label = count > 99 ? '99+' : String(count);
    document.querySelectorAll('#notification-badge, #mobile-notification-badge, [data-notification-badge]').forEach(badge => {
      badge.textContent = label;
      badge.classList.toggle('hidden', !(count > 0));
      if (badge.hasAttribute('data-notification-badge')) badge.hidden = !(count > 0);
    });
  }

  function announce(item) {
    toast.show(item.body || '', {
      type: 'notification',
      title: item.title || 'إشعار جديد',
      duration: 7000,
      sound: true,
      href: notificationsPage()
    });
    // Native bridge (Android WebView) for a system notification when the app is in background
    try { if (window.DOQAndroid && typeof window.DOQAndroid.notify === 'function') window.DOQAndroid.notify(String(item.title || ''), String(item.body || '')); } catch {}
    window.dispatchEvent(new CustomEvent('doq:notification', { detail: item }));
  }

  async function poll() {
    if (stopped) return;
    let data;
    try {
      const url = '/notifications/api/poll' + (lastId === null ? '' : '?after=' + encodeURIComponent(lastId));
      const response = await nativeFetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
      if (response.status === 401 || response.status === 403) { stopPolling(); stopped = true; return; }
      if (!response.ok) return;
      data = (await response.json()).data;
    } catch { return; }
    if (!data) return;
    if (lastId !== null) (data.items || []).forEach(announce);
    lastId = Math.max(Number(lastId || 0), Number(data.latest_id || 0));
    updateBadge(Number(data.count || 0));
  }

  function startPolling() {
    if (stopped) return;
    if (pollTimer) clearInterval(pollTimer);
    poll();
    pollTimer = setInterval(poll, POLL_INTERVAL);
  }
  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // Pages may opt out (e.g. login screens) with <body data-no-notifications>
  function shouldPoll() {
    return !document.body?.hasAttribute('data-no-notifications') && !/^\/(m\/)?auth(\/|$)/.test(location.pathname);
  }

  // ============================================
  // Public namespace
  // ============================================
  window.DOQ = {
    safeImage,
    escape,
    api,
    toast,
    pickRedirect: function (target) {
      try {
        const next = new URLSearchParams(location.search).get('next') || sessionStorage.getItem('doq_next');
        if (target === '/auth/signup2') { if (next) sessionStorage.setItem('doq_next', next); return target; }
        sessionStorage.removeItem('doq_next');
        if (target === '/m' && next && /^\/m(\/[\w-]+)*$/.test(next)) return next;
      } catch {}
      return target;
    },
    notifications: { startPolling, stopPolling, checkNow: poll, updateBadge, playSound }
  };

  document.addEventListener('DOMContentLoaded', () => { if (shouldPoll()) startPolling(); });
  document.addEventListener('visibilitychange', () => {
    if (!shouldPoll()) return;
    if (document.hidden) stopPolling(); else startPolling();
  });

  // Logout links: clear the session through POST and go back to the right login page
  document.addEventListener('click', async event => {
    const link = event.target.closest('a[href^="/auth/logout"]');
    if (!link) return;
    event.preventDefault();
    const mobile = location.pathname.startsWith('/m');
    try {
      const result = await api('/auth/logout', 'POST', { next: mobile ? '/m' : '' });
      location.assign(result.redirect || (mobile ? '/m/auth' : '/auth'));
    } catch {
      location.assign(link.getAttribute('href'));
    }
  });

  const style = document.createElement('style');
  style.textContent = '@keyframes doqToastIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}@keyframes doqToastOut{from{opacity:1}to{opacity:0;transform:translateY(-10px)}}';
  document.head.appendChild(style);
})();
