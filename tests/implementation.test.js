const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('order creation uses one transaction and idempotency key',()=>{const s=read('controller/orders.js');assert.match(s,/transaction\(async db/);assert.match(s,/idempotency_key/);assert.match(s,/if \(!idem\)/);assert.doesNotMatch(s,/await pool\.query\(['"]INSERT INTO notifications/);});
test('customer-facing kitchen and dish responses remove contact data',()=>{assert.match(read('controller/kitchen.js'),/delete publicKitchen\.phone_number/);assert.match(read('controller/dishes.js'),/delete req\.my\.phone_number/);});
test('customer and kitchen chat cannot exchange external contact details',()=>{
  const platform=require('../controller/platform');
  assert.equal(platform.cleanChatBody('ابعتلي على واتساب'),null);
  assert.equal(platform.cleanChatBody('https://example.com'),null);
  assert.equal(platform.cleanChatBody('01012345678'),null);
  assert.equal(platform.cleanChatBody('الطلب وصل للمطبخ'), 'الطلب وصل للمطبخ');
  assert.match(read('controller/platform.js'),/messages\.map\(message => \(\{ \.\.\.message, body: cleanChatBody\(message\.body\) \|\| blocked \}\)\)/);
  assert.doesNotMatch(read('views/dish/dish.ejs'),/kitchenPhone/);
  assert.doesNotMatch(read('views/kitchen/kitchen.ejs'),/(?:href|src)=["'][^"']*(?:wa\.me|tel:)/i);
});
test('Paymob stays reachable as a disabled contract and does not gate chef endpoints',()=>{
  const source=read('controller/payment.js');
  const previous=process.env.PAYMENTS_ENABLED;
  process.env.PAYMENTS_ENABLED='false';
  try {
    const payment=require('../controller/payment');
    assert.equal(payment.paymentsEnabled(),false);
  } finally {
    if(previous===undefined) delete process.env.PAYMENTS_ENABLED; else process.env.PAYMENTS_ENABLED=previous;
  }
  assert.match(source,/PAYMENTS_DISABLED/);
  assert.match(source,/if \(!paymentsEnabled\(\)\) return next\(\);/);
  assert.match(read('.env.development.example'),/PAYMENTS_ENABLED=false/);
  assert.match(read('.env.production.example'),/PAYMENTS_ENABLED=false/);
  assert.match(read('routes/payment.js'),/router\.post\("\/initiate"/);
  assert.match(read('routes/payment.js'),/router\.post\("\/webhook"/);
});
test('migration contains MFA challenge and referral persistence',()=>{const s=read('scripts/migrate.js');assert.match(s,/auth_challenges/);assert.match(s,/referral_signups/);assert.match(s,/email_outbox/);});
test('review error messages use text content instead of HTML injection',()=>{for(const file of ['views/customer/reviews.ejs','views/customer/myreviews.ejs']){const source=read(file);assert.doesNotMatch(source,/innerHTML\\s*=.*err\\.message/);}});
test('PWA shell is present without caching authenticated API responses',()=>{const manifest=JSON.parse(read('public/manifest.webmanifest'));assert.equal(manifest.display,'standalone');assert.equal(manifest.dir,'rtl');assert.match(read('public/app-client.js'),/serviceWorker\.register/);const privateRule=new RegExp(read('public/sw.js').match(/const PRIVATE = \/(.+)\/;/)[1]);for(const p of ['/auth','/auth/signin','/orders/api/v1/my','/admin/api/v1/orders','/users/orders/api','/notifications/api','/my-orders','/delivery'])assert.equal(privateRule.test(p),true,p);for(const p of ['/','/dishes/1','/kitchens'])assert.equal(privateRule.test(p),false,p);});
test('city list is sourced from kitchens instead of a hardcoded list',()=>{assert.equal(read('routes/kitchen.js').includes('/api/v1/cities'),true);assert.match(read('controller/kitchen.js'),/SELECT DISTINCT city FROM kitchens/);});
test('admin operations route exposes approval and assignment UI',()=>{assert.match(read('routes/admin.js'),/\/operations/);assert.match(read('views/admin/operations.ejs'),/pending-accounts/);assert.match(read('views/admin/operations.ejs'),/assign-delivery/);});
test('dish order client has one modal implementation',()=>{const s=read('views/dish/dish.ejs');assert.equal((s.match(/function openOrderModal/g)||[]).length,1);assert.doesNotMatch(s,/doq_csrf\)/);assert.match(s,/Idempotency-Key/);});
test('coupon flow is wired for chef creation and customer redemption',()=>{
  const platform=read('controller/platform.js');
  const routes=read('routes/platform.js');
  const orders=read('controller/orders.js');
  const dish=read('views/dish/dish.ejs');
  const chef=read('views/chef/dishes.ejs');
  assert.match(platform,/createCoupon_controller/);
  assert.match(platform,/coupon_redemptions/);
  assert.match(routes,/\/coupons/);
  assert.match(orders,/FOR UPDATE/);
  assert.match(orders,/INSERT INTO coupon_redemptions/);
  assert.match(dish,/order-coupon/);
  assert.match(dish,/coupon_code/);
  assert.match(chef,/openCouponModal/);
  assert.match(chef,/\/platform\/coupons/);
});
test('coupon migration enforces one redemption per customer and coupon',()=>{
  const migration=read('scripts/migrate.js');
  assert.match(migration,/coupon_id BIGINT/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS coupon_redemptions/);
  assert.match(migration,/uq_coupon_customer/);
  assert.match(migration,/uq_coupon_order/);
});
test('delivery competition exposes one atomic accept and no reject path',()=>{
  const controller=read('controller/orders.js');
  const routes=read('routes/orders.js');
  assert.match(routes,/delivery\/.*\/accept/);
  assert.doesNotMatch(routes,/delivery\/.*\/reject/);
  assert.match(controller,/status='pending' AND delivery_id IS NULL/);
  assert.match(controller,/FOR UPDATE/);
  assert.match(controller,/vehicle_id/);
  assert.match(controller,/CASE WHEN o\.delivery_id=\?/);
  assert.match(controller,/req\.user\.roles === 'delivery'/);
  assert.match(controller,/status !== 'completed'/);
  assert.match(read('views/partials/role_bar.ejs'),/accepted: \{ label: 'اتقبل للتوصيل'/);
});
test('daily report uses Cairo day bounds and keeps coupon redemption history when purging',()=>{
  const cron=read('tasks/cron.js');
  const migration=read('scripts/migrate.js');
  assert.match(cron,/٧٪ الإدارة/);
  assert.match(cron,/purgeReportedCompletedOrders/);
  assert.match(cron,/nextDailyReportDate/);
  assert.match(cron,/DATE_FORMAT\(MAX\(report_date\)/);
  assert.match(migration,/fk_coupon_redemption_order/);
  assert.match(migration,/ON DELETE SET NULL/);
  const {cairoUtcBounds}=require('../tasks/cron');
  const [start,end]=cairoUtcBounds('2026-01-15');
  assert.equal(start,'2026-01-14 22:00:00');
  assert.equal(end,'2026-01-15 22:00:00');
});
test('admin bootstrap is create-only and never escalates an existing account',()=>{
  const source=read('scripts/bootstrap-admin.js');
  assert.match(source,/admin_bootstrap_email_already_exists/);
  assert.doesNotMatch(source,/UPDATE users SET password_hash/);
  assert.match(read('package.json'),/bootstrap:admin/);
});
test('public signup cannot create an admin account by omission or role injection',()=>{
  const validation=read('utiles/validation.js');
  const signupSchema=validation.split('const createAdminUserSchema')[0];
  assert.match(signupSchema,/valid\('customer', 'chef', 'delivery'\)[\s\S]{0,80}default\('customer'\)/);
  assert.doesNotMatch(signupSchema,/valid\([^\n]*'admin'/);
  assert.match(read('scripts/bootstrap-admin.js'),/INSERT INTO users/);
});
test('weekly product reminders do not create a new notification for the same account and week',async()=>{
  const pool=require('../database/pool');
  const original=pool.query;
  const inserted=[];
  pool.query=async(sql,params)=>{
    if(sql.includes('SELECT DISTINCT u.id'))return [[{id:21}]];
    if(sql.includes("u.roles='customer'"))return [[{id:34}]];
    if(sql.startsWith('INSERT IGNORE INTO notifications')){inserted.push(params);return [{affectedRows:1}];}
    throw new Error('Unexpected query in reminder test');
  };
  try{
    await require('../tasks/cron').sendProductReminders();
    await require('../tasks/cron').sendProductReminders();
    assert.equal(inserted.length,4);
    for(const [first,second] of [[inserted[0],inserted[2]],[inserted[1],inserted[3]]]){
      assert.equal(first[4],second[4],'same account must keep one weekly dedupe key');
      assert.match(first[4],/^\w+:\d+:\d{4}-\d{2}-\d{2}$/);
    }
    assert.notEqual(inserted[0][4],inserted[1][4],'different reminder types need different keys');
  }finally{pool.query=original;}
});
test('container bootstrap preserves existing databases and requires database secrets',()=>{
  const schema=read('database/database.sql');
  const compose=read('docker-compose.yml');
  assert.doesNotMatch(schema,/^\s*(DROP DATABASE|CREATE DATABASE|USE\s+DOQ\s*;)/mi);
  assert.match(compose,/MYSQL_ROOT_PASSWORD: \$\{MYSQL_ROOT_PASSWORD:\?/);
  assert.match(compose,/MYSQL_PASSWORD: \$\{DB_PASSWORD:\?/);
});
test('development and production deployment use selectable env files and keep production database private',()=>{
  const development=read('.env.development.example');
  const production=read('.env.production.example');
  const compose=read('docker-compose.yml');
  const productionCompose=read('docker-compose.production.yml');
  assert.match(development,/DOQ_ENV_FILE=\.env\.development/);
  assert.match(production,/DOQ_ENV_FILE=\.env\.production/);
  assert.match(compose,/\$\{DOQ_ENV_FILE:-\.env\}/);
  assert.match(productionCompose,/db:\s*\n\s*ports: !reset \[\]/);
  assert.match(productionCompose,/app:\s*\n\s*ports: !reset \[\]/);
  assert.match(productionCompose,/env_file: !override/);
  assert.match(productionCompose,/caddy:/);
  assert.match(read('Caddyfile'),/reverse_proxy app:3000/);
});

test('security boundaries keep callback exemption exact and never expose the test page in production',()=>{
  const security=read('middlware/security.js');
  const index=read('index.js');
  assert.match(security,/req\.path === '\/payment\/webhook'/);
  assert.doesNotMatch(security,/startsWith\('\/payment\/webhook'\)/);
  assert.match(index,/NODE_ENV !== 'production' && process\.env\.ENABLE_TEST_PAGE === 'true'/);
});

test('payment webhooks have a replay ledger and only activate chef subscriptions',()=>{
  assert.match(read('scripts/migrate.js'),/payment_webhook_events/);
  assert.match(read('controller/payment.js'),/INSERT IGNORE INTO payment_webhook_events/);
  assert.match(read('controller/payment.js'),/roles = 'chef'/);
  assert.match(read('utiles/payment.js'),/source_data/);
  assert.match(read('utiles/payment.js'),/timingSafeEqual/);
});

test('uploads use server generated filenames and seed data has no default password',()=>{
  const upload=read('middlware/upload.js');
  const seed=read('seed_data.js');
  assert.match(upload,/randomBytes\(18\)/);
  assert.doesNotMatch(upload,/file\.originalname\}\`/);
  assert.doesNotMatch(seed,/P@ssword123/);
  assert.match(seed,/DOQ_SEED_PASSWORD/);
});

test('test account bootstrap is create-only, non-production and covers every application role',()=>{
  const script=read('scripts/bootstrap-test-accounts.js');
  const packageJson=read('package.json');
  for (const role of ['customer','chef','delivery','admin']) assert.match(script,new RegExp(`role: '${role}'`));
  assert.match(script,/NODE_ENV === 'production'/);
  assert.match(script,/DOQ_ALLOW_TEST_ACCOUNTS/);
  assert.match(script,/test_account_already_exists/);
  assert.match(packageJson,/bootstrap:test-accounts/);
});

test('public category filters remain reachable to guests while mutations stay behind admin auth',()=>{
  const routes=read('routes/categories.js');
  assert.match(routes,/router\.get\('\/api\/v1\/all', auth\.optional/);
  assert.match(routes,/router\.use\(roles\('admin'\)\)/);
});
test('chef dish cards do not interpolate API JSON into inline handlers',()=>{
  const view=read('views/chef/dishes.ejs');
  assert.doesNotMatch(view,/dishJson|openEditModal\(\$\{dish/);
  assert.match(view,/dishesById/);
  assert.match(view,/openEditModalById\(\$\{dishId\}\)/);
  assert.match(view,/openCouponModalById\(\$\{dishId\}\)/);
});
test('landing page renders one document with the correct dashboard for each role',async()=>{
  const ejs=require('ejs');
  const cases=[
    ['guest',null,'/auth'],
    ['customer',{roles:'customer',first_name:'عميل'},'/my-orders'],
    ['chef',{roles:'chef',first_name:'طباخ'},'/users/dashboard'],
    ['delivery',{roles:'delivery',first_name:'مندوب'},'/delivery'],
    ['admin',{roles:'admin',first_name:'مدير'},'/admin']
  ];
  for(const [role,currentUser,dashboard] of cases){
    const html=await ejs.renderFile('views/index.ejs',{login:role!=='guest',currentUser,categories:[],kitchens:[]});
    assert.equal((html.match(/<!doctype html>/gi)||[]).length,1,role);
    assert.equal((html.match(/<footer\b/gi)||[]).length,1,role);
    assert.match(html,new RegExp(`href="${dashboard}"`),role);
    assert.doesNotMatch(html,/\/users\/dachboard|\/dishes\/my|href="https:\/\/(?:instagram|facebook)\.com"/);
  }
});
