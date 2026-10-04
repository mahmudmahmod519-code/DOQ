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
  window.DOQ = {
    safeImage: value => { try { const url = new URL(String(value || ''), location.origin); return url.protocol === 'https:' || url.origin === location.origin ? url.href.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) : ''; } catch { return ''; } },
    // Sends a customer back to the dish or kitchen that asked them to log in, across the 2FA step.
    pickRedirect(target) {
      try {
        const next = new URLSearchParams(location.search).get('next') || sessionStorage.getItem('doq_next');
        if (target === '/auth/signup2') { if (next) sessionStorage.setItem('doq_next', next); return target; }
        sessionStorage.removeItem('doq_next');
        if (target === '/my-orders' && next && /^\/(dishes|kitchens)\/[\w-]+$/.test(next)) return next;
      } catch {}
      return target;
    },
    escape: value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
    async api(url, method = 'GET', body, extraHeaders = {}) {
      const response = await fetch(url, { method, headers: {'Content-Type':'application/json', Accept:'application/json', ...extraHeaders}, ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
      const data = await response.json();
      if (!response.ok) { const error = new Error(data.message || 'حصل خطأ. حاول تاني'); error.status = response.status; throw error; }
      return data;
    }
  };
  document.addEventListener('click', async event => {
    const link = event.target.closest('a[href="/auth/logout"]');
    if (!link) return;
    event.preventDefault();
    try { await DOQ.api('/auth/logout', 'POST', {}); location.assign('/auth'); }
    catch { alert('تعذر تسجيل الخروج. حاول تاني'); }
  });
})();
