/**
 * Tests for the customer mobile app (/m), cursor pagination, order lifecycle rules,
 * global notifications and the health check API.
 * The database pool is replaced by an in-memory fake, so no MySQL server is needed.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'.repeat(40);
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

// ---------- fake pool ----------
const pool = require('../database/pool');
const calls = [];
let responder = () => [[], []];
pool.query = async (sql, params = []) => {
  const placeholders = (sql.match(/\?/g) || []).length;
  assert.equal(placeholders, params.length, `placeholders/params mismatch in:\n${sql}`);
  calls.push({ sql, params });
  return responder(sql, params);
};
pool.getConnection = async () => ({
  query: (s, p) => pool.query(s, p),
  beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {}
});

function fakeRes() {
  return {
    statusCode: 200, body: null, headers: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    set(k, v) { this.headers[k] = v; return this; }
  };
}

const cursor = require('../utiles/cursor');
const mobile = require('../controller/mobile');
const { canTransition } = require('../controller/orders');

// ---------- cursor ----------
test('cursor: encode/decode round trip and rejects forged values', () => {
  const c = cursor.encodeCursor({ id: 42 });
  assert.deepEqual(cursor.decodeCursor(c), { id: 42 });
  assert.equal(cursor.decodeCursor('not-base64-json'), null);
  assert.equal(cursor.decodeCursor(cursor.encodeCursor({ id: -1 })), null);
  assert.equal(cursor.decodeCursor(cursor.encodeCursor({ id: 'DROP TABLE' })), null);
  assert.equal(cursor.decodeCursor(cursor.encodeCursor([1, 2])), null);
  assert.equal(cursor.decodeCursor('x'.repeat(500)), null);
});

test('cursor: limit is clamped and buildPage detects the next page from limit+1 rows', () => {
  assert.equal(cursor.parseLimit('abc'), cursor.DEFAULT_LIMIT);
  assert.equal(cursor.parseLimit('1000'), cursor.MAX_LIMIT);
  const rows = [{ id: 9 }, { id: 8 }, { id: 7 }];
  const page = cursor.buildPage(rows, 2, r => ({ id: r.id }));
  assert.equal(page.items.length, 2);
  assert.equal(page.has_more, true);
  assert.deepEqual(cursor.decodeCursor(page.next_cursor), { id: 8 });
  const last = cursor.buildPage(rows.slice(0, 2), 2, r => ({ id: r.id }));
  assert.equal(last.has_more, false);
  assert.equal(last.next_cursor, null);
});

// ---------- mobile API ----------
test('mobile dishes feed: keyset query, public kitchens only, cursor continues after last id', async () => {
  calls.length = 0;
  responder = () => [[
    { id: 30, name: 'كشري', price: '45.00', reviews_count: 2, avg_rating: '4.5', is_favourite: 1 },
    { id: 29, name: 'محشي', price: '60.00', reviews_count: 0, avg_rating: null, is_favourite: 0 },
    { id: 28, name: 'زيادة', price: '10.00', reviews_count: 0, avg_rating: null, is_favourite: 0 }
  ]];
  const res = fakeRes();
  await mobile.listDishes_controller({ query: { limit: '2', q: 'ك', category_id: '3' }, user: null }, res);
  const { sql, params } = calls[0];
  assert.match(sql, /k\.status='ACTIVE' AND chef\.account_status='approved'/);
  assert.match(sql, /ORDER BY d\.id DESC LIMIT \?/);
  assert.equal(params[params.length - 1], 3, 'fetches limit + 1 rows');
  assert.equal(res.body.data.items.length, 2);
  assert.equal(res.body.data.has_more, true);
  assert.equal(res.body.data.items[0].price, 45);
  assert.equal(res.body.data.items[0].is_favourite, true);
  assert.equal(res.body.data.items[0].phone_number, undefined);

  calls.length = 0;
  responder = () => [[]];
  await mobile.listDishes_controller({ query: { cursor: res.body.data.next_cursor }, user: null }, fakeRes());
  assert.match(calls[0].sql, /d\.id<\?/);
  assert.ok(calls[0].params.includes(29));
});

test('mobile kitchens / reviews / notifications / my reviews all use cursor pagination', async () => {
  responder = () => [[]];
  const user = { id: 5, roles: 'customer', account_status: 'approved' };
  const c = cursor.encodeCursor({ id: 100 });
  for (const [fn, req, pattern] of [
    [mobile.listKitchens_controller, { query: { cursor: c, city: 'القاهرة' } }, /k\.id<\?/],
    [mobile.listDishReviews_controller, { params: { id: '3' }, query: { cursor: c } }, /r\.id<\?/],
    [mobile.listNotifications_controller, { user, query: { cursor: c } }, /n\.id<\?/],
    [mobile.listMyReviews_controller, { user, query: { cursor: c } }, /r\.id<\?/],
    [mobile.listOrders_controller, { user, query: { cursor: c, status: 'active' } }, /o\.id<\?/]
  ]) {
    calls.length = 0;
    const res = fakeRes();
    await fn(req, res);
    assert.equal(res.body.status, 'success');
    assert.match(calls[0].sql, pattern);
    assert.deepEqual(Object.keys(res.body.data).sort(), ['has_more', 'items', 'next_cursor']);
  }
});

test('mobile favourites use a composite (created_at, dish_id) cursor', async () => {
  const user = { id: 5, roles: 'customer', account_status: 'approved' };
  responder = () => [[
    { id: 4, name: 'a', price: 1, favourited_at: new Date('2026-11-10T10:00:00Z'), available: 1 },
    { id: 3, name: 'b', price: 1, favourited_at: new Date('2026-11-09T10:00:00Z'), available: 0 }
  ]];
  const res = fakeRes();
  await mobile.listFavourites_controller({ user, query: { limit: '1' } }, res);
  const next = cursor.decodeCursor(res.body.data.next_cursor);
  assert.equal(next.id, 4);
  assert.equal(next.t, '2026-11-10T10:00:00.000Z');
  calls.length = 0;
  responder = () => [[]];
  await mobile.listFavourites_controller({ user, query: { cursor: res.body.data.next_cursor } }, fakeRes());
  assert.match(calls[0].sql, /f\.created_at<\? OR \(f\.created_at=\? AND f\.dish_id<\?\)/);
});

test('mobile customer orders only return the signed-in customer orders', async () => {
  calls.length = 0;
  responder = () => [[]];
  const res = fakeRes();
  await mobile.getOrder_controller({ user: { id: 9 }, params: { publicId: '11111111-2222-3333-4444-555555555555' } }, res);
  assert.equal(res.statusCode, 404);
  assert.match(calls[0].sql, /o\.public_id=\? AND o\.customer_id=\?/);
  assert.deepEqual(calls[0].params, ['11111111-2222-3333-4444-555555555555', 9]);
  const bad = fakeRes();
  await mobile.getOrder_controller({ user: { id: 9 }, params: { publicId: "' OR 1=1 --" } }, bad);
  assert.equal(bad.statusCode, 404);
});

test('mobile routes: staff roles are sent back to the web, personal pages need login, next is not an open redirect', () => {
  const routes = require('../routes/mobile');
  assert.equal(routes.safeNext('/m/orders'), '/m/orders');
  assert.equal(routes.safeNext('https://evil.example'), '/m');
  assert.equal(routes.safeNext('//evil.example'), '/m');
  assert.equal(routes.safeNext('/admin'), '/m');
  const src = read('routes/mobile.js');
  assert.match(src, /function customersOnly/);
  assert.match(src, /router\.get\('\/orders', requireCustomerPage/);
  assert.match(src, /router\.get\('\/api\/v1\/orders', requireCustomerApi/);
  assert.match(read('index.js'), /app\.use\('\/m', require\('\.\/routes\/mobile\.js'\)\)/);
});

test('web customer pages redirect guests/customers to the mobile app', () => {
  const toMobile = require('../middlware/customerToMobile');
  const mw = toMobile(req => '/m/dishes/' + req.params.id);
  let redirected = null, passed = false;
  const res = { redirect: (code, url) => { redirected = url; } };
  mw({ method: 'GET', user: null, params: { id: '7' } }, res, () => { passed = true; });
  assert.equal(redirected, '/m/dishes/7');
  redirected = null;
  mw({ method: 'GET', user: { roles: 'chef' }, params: { id: '7' } }, res, () => { passed = true; });
  assert.equal(passed, true);
  assert.equal(redirected, null);
  assert.match(read('routes/dish.js'), /toMobile\(req => '\/m\/dishes\//);
  assert.match(read('routes/kitchen.js'), /toMobile\('\/m\/kitchens'\)/);
  assert.match(read('utiles/session.js'), /: '\/m';/);
});

// ---------- order lifecycle ----------
test('order lifecycle permissions follow pending -> chef_accepted -> accepted -> out_for_delivery -> completed', () => {
  const customer = { id: 1, roles: 'customer', account_status: 'approved' };
  const chef = { id: 2, roles: 'chef', account_status: 'approved' };
  const delivery = { id: 3, roles: 'delivery', account_status: 'approved' };
  const admin = { id: 4, roles: 'admin', account_status: 'approved' };
  const order = (status, delivery_id = null) => ({ status, customer_id: 1, chef_id: 2, delivery_id });

  assert.equal(canTransition(customer, order('pending'), 'cancelled').ok, true);
  assert.equal(canTransition(customer, order('chef_accepted'), 'cancelled').ok, false);
  assert.equal(canTransition(customer, order('out_for_delivery', 3), 'completed').ok, false);

  assert.equal(canTransition(chef, order('chef_accepted'), 'cancelled').ok, true);
  assert.equal(canTransition(chef, order('accepted', 3), 'cancelled').ok, false);
  assert.equal(canTransition(chef, order('out_for_delivery', 3), 'completed').ok, true);
  assert.equal(canTransition(chef, order('accepted', 3), 'completed').ok, false);

  assert.equal(canTransition(delivery, order('accepted', 3), 'completed').ok, true);
  assert.equal(canTransition(delivery, order('out_for_delivery', 3), 'completed').ok, true);
  assert.equal(canTransition(delivery, order('out_for_delivery', 99), 'completed').ok, false);
  assert.equal(canTransition(delivery, order('accepted', 3), 'cancelled').ok, false);

  assert.equal(canTransition(admin, order('out_for_delivery', 3), 'cancelled').ok, true);
  assert.equal(canTransition(admin, order('completed', 3), 'cancelled').error, 409);
  assert.equal(canTransition({ ...chef, account_status: 'suspended' }, order('pending'), 'cancelled').ok, false);
});

test('chef hands the order over only after a delivery accepted it', () => {
  const src = read('controller/orders.js');
  assert.match(src, /WHERE o\.public_id=\? AND o\.status='accepted' AND k\.user_id=\? FOR UPDATE/);
  assert.match(src, /status='out_for_delivery', out_for_delivery_at=UTC_TIMESTAMP\(\) WHERE id=\? AND status='accepted'/);
  assert.match(read('scripts/migrate.js'), /'pending','chef_accepted','accepted','out_for_delivery','completed','cancelled'/);
});

// ---------- notifications ----------
test('notification poll returns only items after the last seen id', async () => {
  const platform = require('../controller/platform');
  calls.length = 0;
  responder = sql => (/COUNT\(CASE/.test(sql) ? [[{ count: 2, latest_id: 12 }]] : [[{ id: 12, title: 't', body: 'b' }]]);
  const res = fakeRes();
  await platform.pollNotifications_controller({ user: { id: 1, account_status: 'approved' }, query: { after: '11' } }, res);
  assert.equal(res.body.data.count, 2);
  assert.equal(res.body.data.latest_id, 12);
  assert.equal(res.body.data.items.length, 1);
  assert.match(calls[1].sql, /id>\? ORDER BY id ASC/);
  const first = fakeRes();
  await platform.pollNotifications_controller({ user: { id: 1, account_status: 'approved' }, query: {} }, first);
  assert.deepEqual(first.body.data.items, []);
});

test('every page polls notifications (toast + sound) and HTML escaping is real', () => {
  const client = read('public/app-client.js');
  assert.match(client, /'&': '&amp;', '<': '&lt;', '>': '&gt;'/);
  assert.match(client, /\/notifications\/api\/poll/);
  assert.match(client, /sound: true/);
  assert.doesNotMatch(client, /getElementById\('notification-bell'\) \|\| document\.getElementById\('mobile-notification-bell'\)\) \{\s*DOQ\.notifications\.startPolling/);
  assert.match(read('routes/notifications.js'), /\/api\/poll/);
  assert.match(read('routes/auth.js'), /router\.post\("\/logout"/);
});

// ---------- health ----------
test('health check API reports database readiness', async () => {
  const health = require('../routes/health');
  responder = () => [[{ ok: 1 }]];
  assert.equal((await health.checkDatabase()).ok, true);
  responder = () => { const e = new Error('down'); e.code = 'ECONNREFUSED'; throw e; };
  const down = await health.checkDatabase();
  assert.equal(down.ok, false);
  assert.equal(down.error, 'ECONNREFUSED');
  const src = read('routes/health.js');
  assert.match(src, /router\.get\('\/health\/ready'/);
  assert.match(src, /router\.get\('\/api\/v1\/health'/);
});

// ---------- views ----------
test('every mobile page renders for guests and customers', async () => {
  const ejs = require('ejs');
  const pages = ['home', 'kitchens', 'kitchen', 'dish', 'orders', 'order', 'favourites', 'notifications', 'account', 'auth'];
  for (const page of pages) {
    for (const user of [null, { first_name: 'سارة' }]) {
      const html = await ejs.renderFile(path.join(__dirname, '..', 'views', 'mobile', page + '.ejs'), {
        pageTitle: 'دوق', page, params: { id: '1', publicId: 'abc', next: '/m', mode: 'login' }, user, activeTab: page
      });
      assert.equal((html.match(/<!doctype html>/gi) || []).length, 1, page);
      assert.match(html, /\/m-assets\/app\.js/, page);
      assert.match(html, /dir="rtl"/, page);
    }
  }
});
