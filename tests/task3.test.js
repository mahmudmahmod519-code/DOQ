const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pool = require('../database/pool');

const read = p => fs.readFileSync(p, 'utf8');

test('Task 3: Admin routes exist for reports and suspend/unsuspend', () => {
    const adminRoutes = read('routes/admin.js');
    assert.match(adminRoutes, /\/reports/);
    assert.match(adminRoutes, /\/api\/v1\/reports\/kitchens/);
    assert.match(adminRoutes, /\/api\/v1\/reports\/kitchens\/:id\/orders/);
    assert.match(adminRoutes, /\/api\/v1\/reports\/delivery/);
    assert.match(adminRoutes, /\/api\/v1\/reports\/delivery\/:id\/orders/);
    assert.match(adminRoutes, /\/api\/v1\/users\/:id\/suspend/);
    assert.match(adminRoutes, /\/api\/v1\/users\/:id\/unsuspend/);
    assert.match(adminRoutes, /\/api\/v1\/kitchens\/:id\/suspend/);
    assert.match(adminRoutes, /\/api\/v1\/kitchens\/:id\/unsuspend/);
});

test('Task 3: Ban/suspend blocks login and terminates active session version', () => {
    const authSource = read('controller/auth.js');
    assert.match(authSource, /account_status === 'suspended'/);
    assert.match(authSource, /تم إيقاف حسابك من قبل الإدارة/);

    const adminSource = read('controller/admin.js');
    assert.match(adminSource, /session_version = session_version \+ 1/);
    assert.match(adminSource, /account_status = 'suspended'/);
});

test('Task 3: Notifications system drops notifications for suspended users', () => {
    const notifSource = read('utiles/notifications.js');
    assert.match(notifSource, /account_status === 'suspended'/);
    assert.match(notifSource, /SELECT account_status FROM users WHERE id=\?/);
});

test('Task 3: Suspended kitchen or chef hides dishes and kitchens from marketplace', () => {
    const kitchenSource = read('controller/kitchen.js');
    assert.match(kitchenSource, /k\.status = 'ACTIVE'/);
    assert.match(kitchenSource, /u\.account_status = 'approved'/);

    const dishSource = read('controller/dishes.js');
    assert.match(dishSource, /kitchen_status === 'SUSPENDED'/);
    assert.match(dishSource, /chef_account_status === 'suspended'/);
});

test('Task 3: Suspended chef cannot see their own dishes', () => {
    const dishSource = read('controller/dishes.js');
    assert.match(dishSource, /if \(req\.user\?\.account_status === 'suspended'\)/);
    assert.match(dishSource, /data: \[\]/);
});

test('Task 3: Suspended customer cannot place orders and gets empty order history', () => {
    const ordersSource = read('controller/orders.js');
    assert.match(ordersSource, /if \(req\.user\?\.account_status === 'suspended'\)/);
    assert.match(ordersSource, /حسابك موقوف من قبل الإدارة/);
    assert.match(ordersSource, /getCustomerOrders_controller[\s\S]*?if \(req\.user\?\.account_status === 'suspended'\)/);
});

test('Task 3: Suspended delivery courier cannot accept orders and gets empty delivery orders', () => {
    const ordersSource = read('controller/orders.js');
    assert.match(ordersSource, /acceptOrder_controller[\s\S]*?if \(req\.user\?\.account_status !== 'approved'\)/);
    assert.match(ordersSource, /getDeliveryOrders_controller[\s\S]*?if \(req\.user\?\.account_status === 'suspended'\)/);
});

test('Task 3: Suspended user sees empty data in for_main middleware and platform notifications/favorites', () => {
    const forMainSource = read('middlware/for_main.js');
    assert.match(forMainSource, /if \(req\.user\.account_status === 'suspended'\)/);
    assert.match(forMainSource, /req\.my = isCollection \? \[\] : null/);

    const platformSource = read('controller/platform.js');
    assert.match(platformSource, /listNotifications_controller[\s\S]*?if \(req\.user\?\.account_status === 'suspended'\)/);
    assert.match(platformSource, /unreadNotificationCount_controller[\s\S]*?if \(req\.user\?\.account_status === 'suspended'\)/);
    assert.match(platformSource, /addFavourite_controller[\s\S]*?if \(req\.user\?\.account_status === 'suspended'\)/);
    assert.match(platformSource, /sendChatMessage_controller[\s\S]*?if \(req\.user\?\.account_status === 'suspended'\)/);
});

test('Task 3: Admin Reports view is rendered with full Arabic layout and tabs', () => {
    const reportsView = read('views/admin/reports.ejs');
    assert.match(reportsView, /محاسبة الطلبات والتقارير الشهرية/);
    assert.match(reportsView, /حسابات المطابخ والطلبات/);
    assert.match(reportsView, /حسابات شركات الدليفري/);
    assert.match(reportsView, /تفاصيل الطلبات/);
    assert.match(reportsView, /إيقاف الحساب/);
});

test('Task 3: Integration test - suspendUser and unsuspendUser update database accurately', async () => {
    const [rows] = await pool.query('SELECT id, account_status FROM users WHERE roles != "admin" LIMIT 1');
    if (!rows.length) return;
    const testUserId = rows[0].id;
    const originalStatus = rows[0].account_status;

    const admin = require('../controller/admin');

    // Test suspend
    let statusSent = null;
    let jsonSent = null;
    const resMock = {
        status: code => { statusSent = code; return resMock; },
        json: data => { jsonSent = data; return resMock; },
        headersSent: false
    };

    await admin.suspendUser_controller({
        params: { id: testUserId },
        user: { id: 999999, roles: 'admin' },
        body: { reason: 'مخالفة معايير الجودة' }
    }, resMock);

    assert.equal(statusSent, 200);
    assert.equal(jsonSent.status, 'success');

    const [[suspendedUser]] = await pool.query('SELECT account_status, suspend_reason, suspended_by FROM users WHERE id = ?', [testUserId]);
    assert.equal(suspendedUser.account_status, 'suspended');
    assert.equal(suspendedUser.suspend_reason, 'مخالفة معايير الجودة');

    // Test unsuspend
    await admin.unsuspendUser_controller({
        params: { id: testUserId },
        user: { id: 999999, roles: 'admin' },
        body: {}
    }, resMock);

    assert.equal(statusSent, 200);
    assert.equal(jsonSent.status, 'success');

    const [[restoredUser]] = await pool.query('SELECT account_status, suspend_reason, suspended_by FROM users WHERE id = ?', [testUserId]);
    assert.equal(restoredUser.account_status, 'approved');
    assert.equal(restoredUser.suspend_reason, null);

    // Restore original status
    await pool.query('UPDATE users SET account_status = ? WHERE id = ?', [originalStatus, testUserId]);
});

test('Task 3: Reports endpoints return structured financial summary and per-entity orders', async () => {
    const admin = require('../controller/admin');

    let statusSent = null;
    let jsonSent = null;
    const resMock = {
        status: code => { statusSent = code; return resMock; },
        json: data => { jsonSent = data; return resMock; },
        headersSent: false
    };

    // Kitchens report
    await admin.getKitchensReport_controller({ query: {} }, resMock);
    assert.equal(statusSent, 200);
    assert.equal(jsonSent.status, 'success');
    assert.ok(jsonSent.summary);
    assert.ok(Array.isArray(jsonSent.data));

    // Delivery report
    await admin.getDeliveryReport_controller({ query: {} }, resMock);
    assert.equal(statusSent, 200);
    assert.equal(jsonSent.status, 'success');
    assert.ok(jsonSent.summary);
    assert.ok(Array.isArray(jsonSent.data));
});

test.after(async () => {
    await pool.end();
});
