(() => {
  'use strict';
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
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

  const notificationSound = new Audio('/sounds/notification.wav');
  notificationSound.volume = 0.5;

  // Unlock audio on first user interaction (browser autoplay policy)
  function unlockAudio() {
    notificationSound.play().catch(() => {}).then(() => {
      notificationSound.pause();
      notificationSound.currentTime = 0;
    });
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  }
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });

  // ============================================
  // Notification System
  // ============================================
  let lastUnreadCount = -1;
  let lastNotificationId = 0;
  let notificationPollInterval = null;
  const POLL_INTERVAL = 10000; // 10 seconds (faster updates)

  async function fetchUnreadCount() {
    try {
      const response = await fetch('/notifications/api/unread-count', { credentials: 'include', cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data) {
          return data.data.count;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch unread count:', e);
    }
    return 0;
  }

  async function fetchLatestNotification() {
    try {
      const response = await fetch('/notifications/api?limit=1', { credentials: 'include', cache: 'no-store' });
      const data = await response.json();
      if (data.status === 'success' && data.data && data.data.length > 0) {
        return data.data[0];
      }
    } catch (e) {
      console.warn('Failed to fetch latest notification:', e);
    }
    return null;
  }

  function updateNotificationBadge(count) {
    const badges = [
      document.getElementById('notification-badge'),
      document.getElementById('mobile-notification-badge')
    ];
    badges.forEach(badge => {
      if (badge) {
        if (count > 0) {
          badge.textContent = count > 99 ? '99+' : count;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
    });
  }

  function showNotificationToast(notification) {
    const { title, body } = notification;
    const message = title || (body || 'إشعار جديد');
    DOQ.toast.show(message, { duration: 3000, type: 'info', sound: true });
  }

  async function checkNotifications() {
    const count = await fetchUnreadCount();
    if (count > lastUnreadCount && lastUnreadCount >= 0) {
      // New notification arrived - fetch latest and show toast
      const notification = await fetchLatestNotification();
      if (notification && notification.id > lastNotificationId) {
        showNotificationToast(notification);
        lastNotificationId = notification.id;
      }
    }
    lastUnreadCount = count;
    updateNotificationBadge(count);
  }

  async function loadInitialNotifications() {
    const count = await fetchUnreadCount();
    lastUnreadCount = count;
    updateNotificationBadge(count);
  }

  function startNotificationPolling() {
    if (notificationPollInterval) clearInterval(notificationPollInterval);
    loadInitialNotifications();
    notificationPollInterval = setInterval(checkNotifications, POLL_INTERVAL);
  }

  function stopNotificationPolling() {
    if (notificationPollInterval) {
      clearInterval(notificationPollInterval);
      notificationPollInterval = null;
    }
  }

  // ============================================
  // DOQ Namespace
  // ============================================
  window.DOQ = {
    safeImage: function(value) { try { const url = new URL(String(value || ''), location.origin); return url.protocol === 'https:' || url.origin === location.origin ? url.href.replace(/[&<>"']/g, function(c) { const map = {'&':'&','<':'<','>':'>','"':'"',"'":"'"}; return map[c]; }) : ''; } catch { return ''; } },
    pickRedirect: function(target) {
      try {
        const next = new URLSearchParams(location.search).get('next') || sessionStorage.getItem('doq_next');
        if (target === '/auth/signup2') { if (next) sessionStorage.setItem('doq_next', next); return target; }
        sessionStorage.removeItem('doq_next');
        if (target === '/my-orders' && next && /^\/(dishes|kitchens)\/[\w-]+$/.test(next)) return next;
      } catch {}
      return target;
    },
    escape: function(value) { return String(value ?? '').replace(/[&<>"']/g, function(char) { return ({'&':'&','<':'<','>':'>','"':'"',"'":"'"}[char]); }); },
    api: async function(url, method, body, extraHeaders) { method = method || 'GET'; const response = await fetch(url, { method: method, headers: {'Content-Type':'application/json', Accept:'application/json', ...extraHeaders}, ...(body === undefined ? {} : {body:JSON.stringify(body)}) }); const data = await response.json(); if (!response.ok) { const error = new Error(data.message || 'حصل خطأ. حاول تاني'); error.status = response.status; throw error; } return data; },
    toast: (function() {
      let container = null;
      let soundEnabled = true;
      function ensureContainer() { if (container) return container; container = document.createElement('div'); container.id = 'doq-toast-container'; container.style.cssText = 'position:fixed;top:1rem;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;max-width:90vw;width:auto;'; document.body.appendChild(container); return container; }
      function playSound() { if (soundEnabled) { const sound = notificationSound.cloneNode(); sound.play().catch(function() {}); } }
      function show(message, options) { options = options || {}; var type = options.type || 'info'; var duration = options.duration || 3000; var action = options.action; var actionText = options.actionText; var sound = options.sound !== false; ensureContainer(); var colorsMap = { info: { bg: '#fff8f6', border: '#e1bfb9', text: '#261816', icon: 'info' }, success: { bg: '#ecfdf5', border: '#10b981', text: '#065f46', icon: 'check_circle' }, error: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b', icon: 'error' }, warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', icon: 'warning' } }; var style = colorsMap[type] || colorsMap.info; var toast = document.createElement('div'); toast.style.cssText = 'pointer-events:auto;padding:0.875rem 1.25rem;border-radius:0.75rem;font-size:0.9375rem;font-weight:500;box-shadow:0 12px 30px rgba(38,24,22,0.15);animation:slideIn 0.3s cubic-bezier(0.25,0.46,0.45,0.94) forwards;max-width:28rem;width:auto;display:flex;align-items:center;gap:0.75rem;'; toast.style.background = style.bg; toast.style.border = '1px solid ' + style.border; toast.style.color = style.text; var icon = document.createElement('span'); icon.className = 'material-symbols-outlined'; icon.textContent = style.icon; icon.style.fontSize = '1.25rem'; toast.appendChild(icon); var text = document.createElement('span'); text.textContent = message; text.style.flex = '1'; text.style.whiteSpace = 'pre-wrap'; toast.appendChild(text); if (action && actionText) { var btn = document.createElement('button'); btn.textContent = actionText; btn.style.cssText = 'flex-shrink:0;padding:0.25rem 0.75rem;border-radius:0.5rem;font-size:0.8125rem;font-weight:600;background:currentColor;color:inherit;border:none;cursor:pointer;opacity:0.8;'; btn.onclick = function() { removeToast(toast); if (action) action(); }; toast.appendChild(btn); } var closeBtn = document.createElement('button'); closeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1.25rem">close</span>'; closeBtn.style.cssText = 'flex-shrink:0;padding:0.25rem;border:none;border-radius:0.5rem;background:transparent;color:inherit;cursor:pointer;opacity:0.6;'; closeBtn.onclick = function() { removeToast(toast); }; toast.appendChild(closeBtn); ensureContainer().appendChild(toast); if (sound) playSound(); setTimeout(function() { removeToast(toast); }, duration); return toast; }
      function removeToast(toast) { toast.style.animation = 'slideOut 0.3s cubic-bezier(0.25,0.46,0.45,0.94) forwards'; setTimeout(function() { toast.remove(); }, 300); }
      function info(message, options) { return show(message, { ...options, type: 'info' }); }
      function success(message, options) { return show(message, { ...options, type: 'success' }); }
      function error(message, options) { return show(message, { ...options, type: 'error' }); }
      function warning(message, options) { return show(message, { ...options, type: 'warning' }); }
      function setSoundEnabled(enabled) { soundEnabled = !!enabled; }
      return { show: show, info: info, success: success, error: error, warning: warning, setSoundEnabled: setSoundEnabled };
    })(),
    notifications: {
      startPolling: startNotificationPolling,
      stopPolling: stopNotificationPolling,
      checkNow: checkNotifications,
      updateBadge: updateNotificationBadge
    }
  };

  // Start notification polling when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    // Only start polling if user is logged in (check for notification bell element)
    if (document.getElementById('notification-bell') || document.getElementById('mobile-notification-bell')) {
      DOQ.notifications.startPolling();
    }
  });

  // Handle page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      DOQ.notifications.stopPolling();
    } else {
      if (document.getElementById('notification-bell') || document.getElementById('mobile-notification-bell')) {
        DOQ.notifications.startPolling();
      }
    }
  });

  document.addEventListener('click', async function(event) { var link = event.target.closest('a[href="/auth/logout"]'); if (!link) return; event.preventDefault(); try { await DOQ.api('/auth/logout', 'POST', {}); location.assign('/auth'); } catch { alert('تعذر تسجيل الخروج. حاول تاني'); } });

  var style = document.createElement('style');
  style.textContent = '@keyframes slideIn { from { opacity: 0; transform: translateX(-50%) translateY(-1rem); } to { opacity: 1; transform: translateX(-50%) translateY(0); } } @keyframes slideOut { from { opacity: 1; transform: translateX(-50%) translateY(0); } to { opacity: 0; transform: translateX(-50%) translateY(-1rem); } }';
  document.head.appendChild(style);
})();