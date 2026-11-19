/**
 * DOQ customer mobile app (served under /m, opened by the Android APK).
 * Vanilla JS, no build step. Every list is an infinite feed using cursor pagination
 * (/m/api/v1/* returns { items, next_cursor, has_more }).
 */
(() => {
  'use strict';

  const DOQ = window.DOQ;
  const esc = v => DOQ.escape(v);
  const body = document.body;
  const PAGE = body.dataset.page;
  const PARAMS = (() => { try { return JSON.parse(body.dataset.params || '{}'); } catch { return {}; } })();
  const LOGGED = body.dataset.logged === '1';
  window.DOQ_NOTIFICATIONS_URL = '/m/notifications';

  // ============================================
  // Icons (inline SVG so the app works without icon fonts)
  // ============================================
  const PATHS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
    store: '<path d="M4 9h16l-1.2-4.2A1 1 0 0 0 17.8 4H6.2a1 1 0 0 0-1 .8z"/><path d="M4 9v1a3 3 0 0 0 5.3 1.9A3 3 0 0 0 12 13a3 3 0 0 0 2.7-1.1A3 3 0 0 0 20 10V9"/><path d="M5 12.5V20h14v-7.5"/><path d="M10 20v-4h4v4"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    heart: '<path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5C19 15.6 12 20 12 20z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'chevron-left': '<path d="m15 6-6 6 6 6"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    chef: '<path d="M6 13a4 4 0 1 1 2-7.5A4 4 0 0 1 16 5.5 4 4 0 1 1 18 13v6H6z"/><path d="M6 17h12"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    file: '<path d="M6 3h9l5 5v13H6z"/><path d="M14 3v6h6"/>',
    logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>'
  };
  const icon = (name, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] || ''}</svg>`;
  function hydrateIcons(root) {
    (root || document).querySelectorAll('i[data-icon]').forEach(el => {
      el.outerHTML = icon(el.dataset.icon, el.className);
    });
  }

  // ============================================
  // Formatting helpers
  // ============================================
  const money = v => Number(v || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج.م';
  const img = (url, fallback) => DOQ.safeImage(url) || fallback;
  const DISH_FALLBACK = '/assests/dish_avatar.jpeg';
  const KITCHEN_COVER = '/assests/background_kitchen.jpeg';
  const KITCHEN_AVATAR = '/assests/profile_kitchen.jpeg';
  function timeAgo(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const s = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
    if (s < 60) return 'دلوقتي';
    if (s < 3600) return `من ${Math.round(s / 60)} دقيقة`;
    if (s < 86400) return `من ${Math.round(s / 3600)} ساعة`;
    if (s < 86400 * 7) return `من ${Math.round(s / 86400)} يوم`;
    return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const fullDate = v => (v ? new Date(v).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
  const stars = n => `<span class="stars" aria-label="${Number(n)} من 5">${[1, 2, 3, 4, 5].map(i => icon('star', i <= Math.round(n) ? 'fill' : '')).join('')}</span>`;
  const ratingTag = (avg, count) => (avg ? `<span class="rating">${icon('star', 'fill')} ${Number(avg).toFixed(1)}${count ? ` <span class="muted">(${count})</span>` : ''}</span>` : '<span class="muted small">جديد</span>');

  const STATUS = {
    pending: 'في انتظار المطبخ',
    chef_accepted: 'المطبخ بيجهز طلبك',
    accepted: 'المندوب في الطريق للمطبخ',
    out_for_delivery: 'طلبك مع المندوب',
    completed: 'اتسلم',
    cancelled: 'اتلغى'
  };
  const statusTag = s => `<span class="status ${esc(s)}">${esc(STATUS[s] || s)}</span>`;

  function emptyState(o) {
    return `<div class="empty">
      <div class="ic-wrap">${icon(o.icon || 'inbox')}</div>
      <h3>${esc(o.title)}</h3>
      ${o.text ? `<p>${esc(o.text)}</p>` : ''}
      ${o.href ? `<a class="btn sm" href="${esc(o.href)}">${esc(o.cta)}</a>` : ''}
    </div>`;
  }

  function goLogin() {
    location.assign('/m/auth?next=' + encodeURIComponent(location.pathname));
  }

  // ============================================
  // Infinite feed with cursor pagination
  // ============================================
  class Feed {
    /**
     * @param {Object} o
     * @param {HTMLElement} o.list - container for items
     * @param {HTMLElement} o.status - container for loader / end / error
     * @param {Function} o.url - (cursor) => request URL
     * @param {Function} o.render - item => HTML
     * @param {Object} o.empty - empty state config
     * @param {Function} [o.onPage] - (page, isFirst) => void
     */
    constructor(o) {
      Object.assign(this, o);
      this.cursor = null;
      this.done = false;
      this.loading = false;
      this.generation = 0;
      this.sentinel = document.createElement('div');
      this.sentinel.className = 'sentinel';
      this.status.after(this.sentinel);
      this.observer = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) this.next();
      }, { rootMargin: '600px 0px' });
      this.observer.observe(this.sentinel);
    }

    reset() {
      this.generation += 1;
      this.cursor = null;
      this.done = false;
      this.loading = false;
      this.list.innerHTML = '';
      this.next();
    }

    async next() {
      if (this.loading || this.done) return;
      this.loading = true;
      const gen = this.generation;
      const first = this.cursor === null;
      this.status.innerHTML = first && this.skeleton ? this.skeleton : '<div class="loader-row"><div class="spinner" role="status" aria-label="جاري التحميل"></div></div>';
      try {
        const res = await DOQ.api(this.url(this.cursor));
        if (gen !== this.generation) return; // a newer reset() happened while loading
        const page = res.data || { items: [] };
        this.list.insertAdjacentHTML('beforeend', page.items.map(this.render).join(''));
        hydrateIcons(this.list);
        this.cursor = page.next_cursor;
        this.done = !page.has_more;
        if (this.onPage) this.onPage(page, first);
        if (first && !page.items.length) {
          this.status.innerHTML = emptyState(this.empty);
        } else {
          this.status.innerHTML = this.done && !first ? '<p class="end-note">وصلت لآخر القائمة</p>' : '';
        }
      } catch (e) {
        if (gen !== this.generation) return;
        if (e.status === 401) return goLogin();
        this.status.innerHTML = `<div class="empty"><div class="ic-wrap">${icon('wifi')}</div><h3>${esc(e.message || 'حصل خطأ في التحميل')}</h3><button class="btn sm" type="button" data-retry>حاول تاني</button></div>`;
        this.status.querySelector('[data-retry]').addEventListener('click', () => this.next());
      } finally {
        if (gen === this.generation) this.loading = false;
      }
      // If the page is taller than the content the observer will not fire again: keep loading
      if (!this.done && gen === this.generation) {
        const r = this.sentinel.getBoundingClientRect();
        if (r.top < window.innerHeight + 600) this.next();
      }
    }
  }

  const qs = (base, params) => {
    const u = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') u.set(k, v); });
    const s = u.toString();
    return s ? `${base}?${s}` : base;
  };
  const statusEl = name => document.querySelector(`[data-feed-status="${name}"]`);

  // ============================================
  // Cards
  // ============================================
  function dishCard(d) {
    return `<article class="card dish-card">
      <a href="/m/dishes/${Number(d.id)}" class="thumb" aria-label="${esc(d.name)}">
        <img src="${img(d.image_url, DISH_FALLBACK)}" alt="" loading="lazy" onerror="this.src='${DISH_FALLBACK}'">
      </a>
      <button type="button" class="fav-btn${d.is_favourite ? ' on' : ''}" data-fav="${Number(d.id)}" aria-pressed="${d.is_favourite ? 'true' : 'false'}" aria-label="${d.is_favourite ? 'شيل من المفضلة' : 'أضف للمفضلة'}">${icon('heart', 'sm')}</button>
      <a href="/m/dishes/${Number(d.id)}" class="body">
        <span class="name">${esc(d.name)}</span>
        <span class="meta ellipsis">${esc(d.kitchen_name || '')}${d.available === false ? ' · غير متاح حالياً' : ''}</span>
        <span class="foot"><span class="price">${money(d.price)}</span>${ratingTag(d.avg_rating)}</span>
      </a>
    </article>`;
  }
  const dishSkeleton = '<div class="grid-2">' + '<div class="card skeleton" style="height:210px"></div>'.repeat(4) + '</div>';

  function kitchenRow(k) {
    return `<a class="card kitchen-row" href="/m/kitchens/${Number(k.id)}">
      <img class="cover" src="${img(k.portfolio_url || k.image_url, KITCHEN_AVATAR)}" alt="" loading="lazy" onerror="this.src='${KITCHEN_AVATAR}'">
      <div class="grow">
        <div class="title ellipsis">${esc(k.title)}</div>
        <div class="muted small ellipsis">${esc(k.description || 'مطبخ بيتي')}</div>
        <div class="row" style="margin-top:6px;flex-wrap:wrap">
          ${ratingTag(k.avg_rating, k.reviews_count)}
          ${k.city ? `<span class="pill">${icon('pin', 'sm')} ${esc(k.city)}</span>` : ''}
          <span class="pill">${Number(k.dishes_count)} طبق</span>
        </div>
      </div>
      ${icon('chevron-left')}
    </a>`;
  }

  function kitchenMini(k) {
    return `<a class="card kitchen-mini" href="/m/kitchens/${Number(k.id)}">
      <div class="cover" style="background-image:url('${img(k.image_url, KITCHEN_COVER)}')"></div>
      <div class="info">
        <img class="avatar" src="${img(k.portfolio_url, KITCHEN_AVATAR)}" alt="" loading="lazy">
        <div class="grow"><div class="ellipsis" style="font-weight:800">${esc(k.title)}</div>
        <div class="row small muted">${ratingTag(k.avg_rating)} · ${Number(k.dishes_count)} طبق</div></div>
      </div>
    </a>`;
  }

  function orderCard(o) {
    return `<a class="card order-card" href="/m/orders/${esc(o.public_id)}">
      <img src="${img(o.dish_image, DISH_FALLBACK)}" alt="" loading="lazy" onerror="this.src='${DISH_FALLBACK}'">
      <div class="grow">
        <div class="row between"><b class="ellipsis">${esc(o.dish_name)} × ${Number(o.quantity)}</b></div>
        <div class="muted small ellipsis">${esc(o.kitchen_name)} · #${esc(o.order_code)}</div>
        <div class="row between" style="margin-top:6px">${statusTag(o.status)}<span class="price">${money(o.total_price)}</span></div>
      </div>
    </a>`;
  }

  function reviewItem(r) {
    return `<div class="review">
      <div class="row between"><b>${esc(r.author || r.dish_name || '')}</b><span class="muted small">${esc(timeAgo(r.created_at))}</span></div>
      ${stars(r.rating)}
      ${r.comment ? `<p style="margin:6px 0 0">${esc(r.comment)}</p>` : ''}
    </div>`;
  }

  // ============================================
  // Favourites (works on every page)
  // ============================================
  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-fav]');
    if (!btn) return;
    e.preventDefault();
    if (!LOGGED) return goLogin();
    const id = btn.dataset.fav;
    const on = btn.getAttribute('aria-pressed') === 'true';
    btn.disabled = true;
    try {
      await DOQ.api('/platform/favourites/' + encodeURIComponent(id), on ? 'DELETE' : 'POST');
      document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach(b => {
        b.classList.toggle('on', !on);
        b.setAttribute('aria-pressed', String(!on));
        b.setAttribute('aria-label', !on ? 'شيل من المفضلة' : 'أضف للمفضلة');
      });
      DOQ.toast.success(on ? 'اتشال من المفضلة' : 'اتضاف للمفضلة', { duration: 1800 });
      if (on && PAGE === 'favourites') btn.closest('.dish-card')?.remove();
    } catch (err) {
      if (err.status === 401) return goLogin();
      DOQ.toast.error(err.message);
    } finally {
      btn.disabled = false;
    }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('[data-back]')) return;
    if (history.length > 1 && document.referrer && new URL(document.referrer).origin === location.origin) history.back();
    else location.assign('/m');
  });

  // Active orders badge on the "طلباتي" tab
  async function refreshActiveBadge() {
    const badge = document.querySelector('[data-active-orders]');
    if (!badge || !LOGGED) return;
    try {
      const res = await DOQ.api('/m/api/v1/orders?status=active&limit=10');
      const n = res.data.items.length;
      badge.textContent = res.data.has_more ? '9+' : String(n);
      badge.classList.toggle('hidden', n === 0);
    } catch {}
  }

  // ============================================
  // Pages
  // ============================================
  const pages = {};

  pages.home = () => {
    const list = document.getElementById('dishes');
    const title = document.getElementById('dishes-title');
    const form = document.getElementById('search-form');
    const input = document.getElementById('q');
    const state = { q: new URLSearchParams(location.search).get('q') || '', category_id: '' };
    input.value = state.q;

    const feed = new Feed({
      list, status: statusEl('dishes'), skeleton: dishSkeleton,
      url: cursor => qs('/m/api/v1/dishes', { cursor, q: state.q, category_id: state.category_id }),
      render: dishCard,
      empty: { icon: 'search', title: 'مفيش أطباق مطابقة', text: 'جرب كلمة تانية أو تصنيف مختلف' }
    });

    function apply() {
      title.textContent = state.q ? `نتائج "${state.q}"` : 'كل الأطباق';
      document.getElementById('kitchens-block').hidden = Boolean(state.q || state.category_id);
      history.replaceState(null, '', qs('/m', { q: state.q }));
      feed.reset();
    }

    form.addEventListener('submit', e => { e.preventDefault(); state.q = input.value.trim(); input.blur(); apply(); });
    input.addEventListener('search', () => { if (!input.value) { state.q = ''; apply(); } });

    const cats = document.getElementById('categories');
    cats.addEventListener('click', e => {
      const chip = e.target.closest('[data-cat]');
      if (!chip) return;
      state.category_id = chip.dataset.cat;
      cats.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
      title.textContent = chip.dataset.cat ? chip.dataset.name : 'كل الأطباق';
      document.getElementById('kitchens-block').hidden = Boolean(state.q || state.category_id);
      feed.reset();
    });

    DOQ.api('/m/api/v1/home').then(res => {
      const { categories, kitchens } = res.data;
      cats.innerHTML = '<button type="button" class="chip active" data-cat="">الكل</button>'
        + categories.map(c => `<button type="button" class="chip" data-cat="${Number(c.id)}" data-name="${esc(c.name)}">${esc(c.name)} <span class="count">${Number(c.dishes_count)}</span></button>`).join('');
      const strip = document.getElementById('kitchens-strip');
      strip.innerHTML = kitchens.length ? kitchens.map(kitchenMini).join('') : '<p class="muted small">لسه مفيش مطابخ متاحة</p>';
    }).catch(() => { cats.innerHTML = ''; });

    if (state.q) apply(); else feed.next();
  };

  pages.kitchens = () => {
    const state = { q: '', city: '' };
    const feed = new Feed({
      list: document.getElementById('kitchens'), status: statusEl('kitchens'),
      skeleton: '<div class="stack">' + '<div class="card skeleton" style="height:108px"></div>'.repeat(4) + '</div>',
      url: cursor => qs('/m/api/v1/kitchens', { cursor, q: state.q, city: state.city }),
      render: kitchenRow,
      empty: { icon: 'store', title: 'مفيش مطابخ مطابقة', text: 'جرب مدينة تانية أو امسح البحث' }
    });
    const input = document.getElementById('q');
    document.getElementById('search-form').addEventListener('submit', e => { e.preventDefault(); state.q = input.value.trim(); input.blur(); feed.reset(); });
    input.addEventListener('search', () => { if (!input.value) { state.q = ''; feed.reset(); } });
    const cities = document.getElementById('cities');
    DOQ.api('/m/api/v1/cities').then(res => {
      if (!res.data.length) return;
      cities.innerHTML = '<button type="button" class="chip active" data-city="">كل المدن</button>'
        + res.data.map(c => `<button type="button" class="chip" data-city="${esc(c)}">${icon('pin', 'sm')} ${esc(c)}</button>`).join('');
    }).catch(() => {});
    cities.addEventListener('click', e => {
      const chip = e.target.closest('[data-city]');
      if (!chip) return;
      state.city = chip.dataset.city;
      cities.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
      feed.reset();
    });
    feed.next();
  };

  pages.kitchen = async () => {
    const id = Number(PARAMS.id);
    try {
      const k = (await DOQ.api('/m/api/v1/kitchens/' + id)).data;
      document.title = `${k.title} | دوق`;
      document.getElementById('kitchen-cover').style.backgroundImage = `url('${img(k.image_url, KITCHEN_COVER)}')`;
      document.getElementById('kitchen-avatar').src = img(k.portfolio_url, KITCHEN_AVATAR);
      document.getElementById('kitchen-title').textContent = k.title;
      document.getElementById('kitchen-sub').innerHTML = [k.city ? `${icon('pin', 'sm')} ${esc(k.city)}` : '', k.chef_first_name ? `${icon('chef', 'sm')} الشيف ${esc(k.chef_first_name)}` : ''].filter(Boolean).join(' · ');
      document.getElementById('kitchen-desc').textContent = k.description || '';
      document.getElementById('kitchen-stats').innerHTML = `
        <div class="card stat"><b>${k.avg_rating ? Number(k.avg_rating).toFixed(1) : '—'}</b><span>التقييم (${k.reviews_count})</span></div>
        <div class="card stat"><b>${k.dishes_count}</b><span>طبق</span></div>
        <div class="card stat"><b>${k.delivery_fee ? money(k.delivery_fee) : 'مجاني'}</b><span>التوصيل</span></div>`;
    } catch (e) {
      document.getElementById('app').innerHTML = emptyState({ icon: 'store', title: e.message || 'المطبخ مش متاح', href: '/m/kitchens', cta: 'شوف مطابخ تانية' });
      return;
    }
    new Feed({
      list: document.getElementById('dishes'), status: statusEl('dishes'), skeleton: dishSkeleton,
      url: cursor => qs('/m/api/v1/dishes', { cursor, kitchen_id: id }),
      render: dishCard,
      empty: { icon: 'chef', title: 'المطبخ لسه مضافش أطباق' }
    }).next();
  };

  pages.dish = async () => {
    const id = Number(PARAMS.id);
    let dish;
    try {
      dish = (await DOQ.api('/m/api/v1/dishes/' + id)).data;
    } catch (e) {
      document.getElementById('app').innerHTML = '<div style="height:60px"></div>' + emptyState({ icon: 'bag', title: e.message || 'الطبق مش متاح', href: '/m', cta: 'ارجع للرئيسية' });
      return;
    }
    document.title = `${dish.name} | دوق`;
    document.getElementById('dish-image').src = img(dish.image_url, DISH_FALLBACK);
    document.getElementById('dish-image').alt = dish.name;
    document.getElementById('dish-info').innerHTML = `
      <div class="row between" style="align-items:flex-start">
        <h1 class="grow">${esc(dish.name)}</h1>
        <button type="button" class="icon-btn${dish.is_favourite ? ' on' : ''}" style="background:var(--surface-2);color:var(--primary)" data-fav="${dish.id}" aria-pressed="${dish.is_favourite}" aria-label="المفضلة">${icon('heart')}</button>
      </div>
      <div class="row" style="margin-top:6px;flex-wrap:wrap;gap:10px">
        <span class="price" style="font-size:20px">${money(dish.price)}</span>
        ${ratingTag(dish.avg_rating, dish.reviews_count)}
        <span class="pill">${esc(dish.category_name)}</span>
      </div>
      <a class="card kitchen-row" style="margin-top:14px" href="/m/kitchens/${dish.kitchen_id}">
        <img class="avatar" src="${img(dish.kitchen_image, KITCHEN_AVATAR)}" alt="">
        <div class="grow"><div class="muted small">من مطبخ</div><b class="ellipsis">${esc(dish.kitchen_name)}</b></div>
        ${icon('chevron-left')}
      </a>`;
    const details = document.getElementById('dish-details');
    details.hidden = false;
    details.innerHTML = `
      ${dish.description ? `<h2 style="font-size:16px;margin:0 0 6px">الوصف</h2><p class="muted" style="margin:0 0 14px">${esc(dish.description)}</p>` : ''}
      ${dish.ingredients.length ? `<h2 style="font-size:16px;margin:0 0 8px">المكونات</h2><div class="tags">${dish.ingredients.map(i => `<span class="pill">${esc(i)}</span>`).join('')}</div>` : ''}
      <div class="card pad" style="margin-top:14px">
        <div class="kv"><span class="muted">رسوم التوصيل</span><b>${dish.delivery_fee ? money(dish.delivery_fee) : 'مجاني'}</b></div>
        <div class="kv"><span class="muted">المدينة</span><b>${esc(dish.kitchen_city || '—')}</b></div>
      </div>`;

    document.getElementById('reviews-summary').textContent = dish.reviews_count ? `${dish.reviews_count} تقييم` : '';
    new Feed({
      list: document.getElementById('reviews'), status: statusEl('reviews'),
      url: cursor => qs(`/m/api/v1/dishes/${id}/reviews`, { cursor }),
      render: reviewItem,
      empty: { icon: 'star', title: 'لسه مفيش تقييمات', text: 'اطلب الطبق وكن أول واحد يقيّمه' }
    }).next();

    renderReviewForm(dish);
    setupOrderSheet(dish);
  };

  function renderReviewForm(dish) {
    const slot = document.getElementById('review-form-slot');
    if (!LOGGED) {
      slot.innerHTML = `<a class="btn outline block" style="margin-bottom:12px" href="/m/auth?next=${encodeURIComponent(location.pathname)}">سجل دخول عشان تقيّم</a>`;
      return;
    }
    if (dish.my_review) {
      slot.innerHTML = `<div class="card pad" style="margin-bottom:12px"><div class="muted small">تقييمك</div>${stars(dish.my_review.rating)}${dish.my_review.comment ? `<p style="margin:6px 0 0">${esc(dish.my_review.comment)}</p>` : ''}</div>`;
      return;
    }
    slot.innerHTML = `<form class="card pad stack" id="review-form" style="margin-bottom:12px">
      <b>قيّم الطبق</b>
      <div class="star-input" role="radiogroup" aria-label="التقييم">${[5, 4, 3, 2, 1].map(n => `<button type="button" data-rate="${n}" aria-label="${n} نجوم">${icon('star', 'fill')}</button>`).join('')}</div>
      <textarea class="input" name="comment" maxlength="1000" placeholder="اكتب رأيك (اختياري)"></textarea>
      <div class="form-error" role="alert"></div>
      <button class="btn block" type="submit">إرسال التقييم</button>
    </form>`;
    const form = document.getElementById('review-form');
    let rating = 0;
    form.querySelector('.star-input').addEventListener('click', e => {
      const b = e.target.closest('[data-rate]');
      if (!b) return;
      rating = Number(b.dataset.rate);
      form.querySelectorAll('[data-rate]').forEach(x => x.classList.toggle('on', Number(x.dataset.rate) <= rating));
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const err = form.querySelector('.form-error');
      if (!rating) { err.textContent = 'اختار عدد النجوم الأول'; return; }
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        await DOQ.api('/reviews/v1/api', 'POST', { dish_id: dish.id, rating, comment: form.comment.value.trim() });
        DOQ.toast.success('شكراً! تقييمك اتسجل');
        dish.my_review = { rating, comment: form.comment.value.trim() };
        renderReviewForm(dish);
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false;
      }
    });
  }

  function newIdempotencyKey() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'k-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  function setupOrderSheet(dish) {
    const cta = document.getElementById('cta');
    const sheet = document.getElementById('order-sheet');
    const backdrop = document.getElementById('order-backdrop');
    const qtyEl = document.getElementById('qty');
    const summary = document.getElementById('order-summary');
    const errorEl = document.getElementById('order-error');
    const couponMsg = document.getElementById('coupon-msg');
    const state = { qty: 1, coupon: null, key: newIdempotencyKey(), submitting: false };
    cta.hidden = false;
    document.getElementById('cta-price').textContent = money(dish.price);

    function renderSummary() {
      const gross = dish.price * state.qty;
      const discount = state.coupon ? state.coupon.discount_amount : 0;
      const total = gross - discount;
      qtyEl.textContent = state.qty;
      summary.innerHTML = `
        <div class="kv"><span class="muted">${esc(dish.name)} × ${state.qty}</span><b>${money(gross)}</b></div>
        ${discount ? `<div class="kv"><span class="muted">خصم الكوبون (${state.coupon.discount_percent}%)</span><b style="color:var(--ok)">− ${money(discount)}</b></div>` : ''}
        ${dish.delivery_fee ? `<div class="kv"><span class="muted">التوصيل (يتدفع للمندوب)</span><b>${money(dish.delivery_fee)}</b></div>` : ''}
        <div class="kv"><span>الإجمالي ${dish.delivery_fee ? '(من غير التوصيل)' : ''}</span><b class="price" style="font-size:18px">${money(total)}</b></div>`;
    }

    async function open() {
      if (!LOGGED) return goLogin();
      sheet.hidden = false; backdrop.hidden = false;
      requestAnimationFrame(() => { sheet.classList.add('open'); backdrop.classList.add('open'); });
      renderSummary();
      document.getElementById('order-name').focus({ preventScroll: true });
      try {
        const me = (await DOQ.api('/m/api/v1/me')).data;
        const addr = [me.city, me.address].filter(Boolean).join(' - ');
        document.getElementById('order-address').textContent = addr || 'مفيش عنوان مسجل. ضيفه من حسابي عشان المندوب يوصلك';
      } catch {}
    }
    function close() {
      sheet.classList.remove('open'); backdrop.classList.remove('open');
      setTimeout(() => { sheet.hidden = true; backdrop.hidden = true; }, 250);
    }

    document.getElementById('open-order').addEventListener('click', open);
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) close(); });
    sheet.addEventListener('click', e => {
      const b = e.target.closest('[data-qty]');
      if (!b) return;
      state.qty = Math.min(50, Math.max(1, state.qty + Number(b.dataset.qty)));
      if (state.coupon) { state.coupon = null; couponMsg.textContent = 'الكمية اتغيرت. طبّق الكوبون تاني'; couponMsg.style.color = 'var(--muted)'; }
      renderSummary();
    });

    document.getElementById('apply-coupon').addEventListener('click', async () => {
      const code = document.getElementById('coupon').value.trim().toUpperCase();
      if (!code) { couponMsg.textContent = 'اكتب الكود الأول'; return; }
      try {
        const res = await DOQ.api('/platform/coupons/validate', 'POST', { dish_id: dish.id, quantity: state.qty, code });
        state.coupon = { code, ...res.data };
        couponMsg.textContent = `تم تطبيق خصم ${res.data.discount_percent}%`;
        couponMsg.style.color = 'var(--ok)';
      } catch (e) {
        state.coupon = null;
        couponMsg.textContent = e.message;
        couponMsg.style.color = 'var(--danger)';
      }
      renderSummary();
    });

    document.getElementById('order-form').addEventListener('submit', async e => {
      e.preventDefault();
      if (state.submitting) return;
      const name = document.getElementById('order-name').value.trim();
      if (name.length < 2) { errorEl.textContent = 'اكتب اسم للطلب (حرفين على الأقل)'; return; }
      errorEl.textContent = '';
      state.submitting = true;
      const btn = document.getElementById('confirm-order');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px"></span>';
      try {
        const res = await DOQ.api('/orders/api/v1', 'POST', {
          dish_id: dish.id, quantity: state.qty, order_name: name, coupon_code: state.coupon ? state.coupon.code : ''
        }, { 'Idempotency-Key': state.key });
        DOQ.toast.success(res.message || 'تم إرسال الطلب');
        location.assign('/m/orders/' + encodeURIComponent(res.data.public_id));
      } catch (ex) {
        if (ex.status === 401) return goLogin();
        errorEl.textContent = ex.message;
        state.key = newIdempotencyKey();
        state.submitting = false;
        btn.disabled = false;
        btn.textContent = 'تأكيد الطلب';
      }
    });
  }

  pages.orders = () => {
    let status = 'active';
    const feed = new Feed({
      list: document.getElementById('orders'), status: statusEl('orders'),
      skeleton: '<div class="stack">' + '<div class="card skeleton" style="height:90px"></div>'.repeat(3) + '</div>',
      url: cursor => qs('/m/api/v1/orders', { cursor, status }),
      render: orderCard,
      empty: { icon: 'receipt', title: 'مفيش طلبات هنا', text: 'اختار طبق من المطابخ واطلبه في ثواني', href: '/m', cta: 'تصفح الأطباق' }
    });
    document.getElementById('order-tabs').addEventListener('click', e => {
      const b = e.target.closest('[data-status]');
      if (!b || b.dataset.status === status) return;
      status = b.dataset.status;
      document.querySelectorAll('#order-tabs button').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', String(x === b)); });
      feed.reset();
    });
    window.addEventListener('doq:notification', () => feed.reset());
    feed.next();
  };

  const STEPS = [
    ['pending', 'created_at', 'الطلب اتبعت للمطبخ'],
    ['chef_accepted', 'chef_accepted_at', 'المطبخ قبل الطلب وبيجهزه'],
    ['accepted', 'accepted_at', 'مندوب التوصيل قبل الطلب'],
    ['out_for_delivery', 'out_for_delivery_at', 'الطلب مع المندوب في الطريق ليك'],
    ['completed', 'completed_at', 'الطلب اتسلم. بالهنا والشفا']
  ];

  pages.order = () => {
    const view = document.getElementById('order-view');
    const publicId = String(PARAMS.publicId || '');
    async function load() {
      let o;
      try {
        o = (await DOQ.api('/m/api/v1/orders/' + encodeURIComponent(publicId))).data;
      } catch (e) {
        if (e.status === 401) return goLogin();
        view.innerHTML = emptyState({ icon: 'receipt', title: e.message || 'الطلب مش موجود', href: '/m/orders', cta: 'طلباتي' });
        return;
      }
      const idx = STEPS.findIndex(s => s[0] === o.status);
      const timeline = o.status === 'cancelled'
        ? `<div class="card pad" style="background:#fef2f2;border-color:#fecaca"><b style="color:var(--danger)">الطلب ده اتلغى</b><p class="muted small" style="margin:4px 0 0">لو دفعت أي مبلغ تواصل معانا من صفحة اتصل بنا</p></div>`
        : `<ol class="timeline">${STEPS.map((s, i) => {
            const cls = i < idx || o.status === 'completed' ? 'done' : i === idx ? 'current' : 'todo';
            return `<li class="${cls}"><span class="dot">${cls === 'done' ? icon('check', 'sm') : ''}</span><b>${s[2]}</b>${o[s[1]] ? `<small>${esc(fullDate(o[s[1]]))}</small>` : ''}</li>`;
          }).join('')}</ol>`;
      view.innerHTML = `
        <div class="card pad">
          <div class="row between"><span class="muted small">رقم الطلب</span><b dir="ltr">#${esc(o.order_code)}</b></div>
          <div class="row" style="margin-top:12px">
            <img src="${img(o.dish_image, DISH_FALLBACK)}" alt="" style="width:64px;height:64px;border-radius:12px;object-fit:cover">
            <div class="grow"><b>${esc(o.dish_name)} × ${Number(o.quantity)}</b><div class="muted small">${esc(o.kitchen_name)}</div><div style="margin-top:4px">${statusTag(o.status)}</div></div>
          </div>
        </div>
        <div class="card pad" style="margin-top:12px">${timeline}</div>
        <div class="card pad" style="margin-top:12px">
          <div class="kv"><span class="muted">اسم الطلب</span><b>${esc(o.order_name || '—')}</b></div>
          <div class="kv"><span class="muted">سعر الوحدة</span><b>${money(o.unit_price)}</b></div>
          ${o.discount_amount ? `<div class="kv"><span class="muted">الخصم</span><b style="color:var(--ok)">− ${money(o.discount_amount)}</b></div>` : ''}
          ${o.delivery_fee_amount ? `<div class="kv"><span class="muted">التوصيل</span><b>${money(o.delivery_fee_amount)}</b></div>` : ''}
          <div class="kv"><span>الإجمالي ${o.delivery_fee_amount ? '(من غير التوصيل)' : ''}</span><b class="price">${money(o.total_price)}</b></div>
          <div class="kv"><span class="muted">العنوان</span><b style="text-align:left">${esc(o.customer_address || '—')}</b></div>
        </div>
        <div class="stack" style="margin-top:14px">
          ${o.can_cancel ? '<button class="btn danger block" type="button" id="cancel-order">إلغاء الطلب</button>' : ''}
          ${o.status === 'completed' && !o.has_review ? `<a class="btn block" href="/m/dishes/${Number(o.dish_id)}#review-form-slot">قيّم الطبق</a>` : ''}
          <a class="btn outline block" href="/m/dishes/${Number(o.dish_id)}">اطلبه تاني</a>
        </div>`;
      const cancel = document.getElementById('cancel-order');
      if (cancel) cancel.addEventListener('click', async () => {
        if (!confirm('متأكد إنك عايز تلغي الطلب؟')) return;
        cancel.disabled = true;
        try {
          await DOQ.api('/orders/api/v1/' + encodeURIComponent(o.public_id) + '/status', 'PATCH', { status: 'cancelled' });
          DOQ.toast.success('تم إلغاء الطلب');
          load();
        } catch (e) { DOQ.toast.error(e.message); cancel.disabled = false; }
      });
      if (['completed', 'cancelled'].includes(o.status)) clearInterval(timer);
    }
    const timer = setInterval(() => { if (!document.hidden) load(); }, 15000);
    window.addEventListener('doq:notification', load);
    load();
  };

  pages.favourites = () => {
    new Feed({
      list: document.getElementById('favourites'), status: statusEl('favourites'), skeleton: dishSkeleton,
      url: cursor => qs('/m/api/v1/favourites', { cursor }),
      render: dishCard,
      empty: { icon: 'heart', title: 'مفيش أطباق في المفضلة', text: 'دوس على القلب في أي طبق عشان تلاقيه هنا بسرعة', href: '/m', cta: 'تصفح الأطباق' }
    }).next();
  };

  pages.notifications = () => {
    const feed = new Feed({
      list: document.getElementById('notifications'), status: statusEl('notifications'),
      url: cursor => qs('/m/api/v1/notifications', { cursor }),
      render: n => `<a class="card notif${n.read_at ? '' : ' unread'}" href="${n.order_public_id ? '/m/orders/' + esc(n.order_public_id) : '#'}" data-notif="${Number(n.id)}" data-read="${n.read_at ? 1 : 0}">
          <span class="dotc">${icon(n.type && n.type.includes('deliver') ? 'truck' : n.type && n.type.includes('order') ? 'receipt' : 'bell')}</span>
          <span class="grow"><span class="row between"><span class="title">${esc(n.title)}</span><span class="muted small">${esc(timeAgo(n.created_at))}</span></span>
          <span class="body">${esc(n.body)}</span></span>
        </a>`,
      empty: { icon: 'bell', title: 'مفيش إشعارات لسه', text: 'أول ما حالة طلبك تتغير هتلاقي إشعار هنا' }
    });
    document.getElementById('notifications').addEventListener('click', async e => {
      const a = e.target.closest('[data-notif]');
      if (!a) return;
      if (a.getAttribute('href') === '#') e.preventDefault();
      if (a.dataset.read === '0') {
        a.dataset.read = '1';
        a.classList.remove('unread');
        try { await DOQ.api('/notifications/api/' + a.dataset.notif + '/read', 'PATCH', {}); DOQ.notifications.checkNow(); } catch {}
      }
    });
    document.getElementById('read-all').addEventListener('click', async () => {
      try {
        await DOQ.api('/notifications/api/read-all', 'PATCH', {});
        DOQ.notifications.updateBadge(0);
        feed.reset();
      } catch (e) { DOQ.toast.error(e.message); }
    });
    window.addEventListener('doq:notification', () => feed.reset());
    feed.next();
  };

  pages.account = async () => {
    const form = document.getElementById('profile-form');
    try {
      const me = (await DOQ.api('/m/api/v1/me')).data;
      document.getElementById('profile-name').textContent = `${me.first_name} ${me.last_name}`;
      document.getElementById('profile-email').textContent = me.email;
      document.getElementById('profile-stats').innerHTML = `
        <a class="card stat" href="/m/orders"><b>${me.stats.orders_count}</b><span>طلب</span></a>
        <a class="card stat" href="/m/favourites"><b>${me.stats.favourites_count}</b><span>مفضلة</span></a>
        <div class="card stat"><b>${me.stats.reviews_count}</b><span>تقييم</span></div>`;
      ['first_name', 'last_name', 'phone_number', 'city', 'address'].forEach(k => { form[k].value = me[k] || ''; });
    } catch (e) {
      if (e.status === 401) return goLogin();
      DOQ.toast.error(e.message);
    }
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const err = document.getElementById('profile-error');
      err.textContent = '';
      const payload = {};
      ['first_name', 'last_name', 'phone_number', 'city', 'address'].forEach(k => { const v = form[k].value.trim(); if (v) payload[k] = v; });
      if (payload.phone_number && !/^(010|011|012|015)\d{8}$/.test(payload.phone_number)) { err.textContent = 'رقم الموبايل لازم يكون مصري صحيح (01xxxxxxxxx)'; return; }
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        await DOQ.api('/users/api/v1/', 'PUT', payload);
        DOQ.toast.success('تم حفظ بياناتك');
        document.getElementById('profile-name').textContent = `${payload.first_name || ''} ${payload.last_name || ''}`.trim();
      } catch (ex) {
        err.textContent = ex.message;
      } finally { btn.disabled = false; }
    });
    new Feed({
      list: document.getElementById('my-reviews'), status: statusEl('my-reviews'),
      url: cursor => qs('/m/api/v1/reviews/my', { cursor, limit: 5 }),
      render: r => `<a class="review" style="display:block" href="/m/dishes/${Number(r.dish_id)}">
          <div class="row between"><b class="ellipsis">${esc(r.dish_name)}</b><span class="muted small">${esc(timeAgo(r.created_at))}</span></div>
          <div class="muted small">${esc(r.kitchen_name)}</div>${stars(r.rating)}
          ${r.comment ? `<p style="margin:6px 0 0">${esc(r.comment)}</p>` : ''}</a>`,
      empty: { icon: 'star', title: 'لسه ما قيمتش أي طبق' }
    }).next();
  };

  pages.auth = () => {
    const next = PARAMS.next || '/m';
    const tabs = document.getElementById('auth-tabs');
    const login = document.getElementById('login-form');
    const signup = document.getElementById('signup-form');
    if (!tabs.querySelector('.active')) tabs.querySelector('[data-mode="login"]').classList.add('active');
    tabs.addEventListener('click', e => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      tabs.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      login.hidden = b.dataset.mode !== 'login';
      signup.hidden = b.dataset.mode !== 'signup';
    });
    if (new URLSearchParams(location.search).get('pending')) DOQ.toast.info('حسابك مستني موافقة الإدارة');

    function finish(result) {
      // 2FA: go to the shared verification step, then come back to the app
      if (result.redirect === '/auth/signup2') {
        try { sessionStorage.setItem('doq_next', next); } catch {}
        location.assign('/auth/signup2?next=' + encodeURIComponent(next));
        return;
      }
      if (result.redirect && result.redirect !== '/m' && !result.redirect.startsWith('/m')) {
        location.assign(result.redirect); // staff account signed in from the app: send it to its web dashboard
        return;
      }
      location.assign(next);
    }

    async function submit(form, url, payload) {
      const err = form.querySelector('[data-error]');
      const btn = form.querySelector('[type=submit]');
      err.textContent = '';
      btn.disabled = true;
      try {
        const result = await DOQ.api(url, 'POST', payload);
        finish(result);
      } catch (e) {
        err.textContent = e.message;
        btn.disabled = false;
      }
    }

    login.addEventListener('submit', e => {
      e.preventDefault();
      const email = login.email.value.trim();
      const password = login.password.value;
      if (!email || !password) { login.querySelector('[data-error]').textContent = 'اكتب الإيميل وكلمة المرور'; return; }
      submit(login, '/auth/signin', { email, password });
    });
    signup.addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(signup).entries());
      Object.keys(data).forEach(k => { data[k] = String(data[k]).trim(); });
      if (data.password !== data.password_confirmation) { signup.querySelector('[data-error]').textContent = 'تأكيد كلمة المرور مش مطابق'; return; }
      data.roles = 'customer';
      submit(signup, '/auth/signup', data);
    });
  };

  // ============================================
  // Boot
  // ============================================
  document.addEventListener('DOMContentLoaded', () => {
    hydrateIcons();
    const appbar = document.getElementById('appbar');
    if (appbar && appbar.classList.contains('transparent')) {
      const onScroll = () => appbar.classList.toggle('transparent', window.scrollY < 120);
      window.addEventListener('scroll', onScroll, { passive: true });
    }
    refreshActiveBadge();
    window.addEventListener('doq:notification', refreshActiveBadge);
    if (pages[PAGE]) pages[PAGE]();
  });
})();
