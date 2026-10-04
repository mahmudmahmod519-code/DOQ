// Guards for defects found on 2026-09-29: files that did not parse, one generic error text used for
// success and failure alike, Arabic text lost as question marks, and customer data reaching the kitchen.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const skip = new Set(['node_modules', 'tmp', '.git', 'backups']);
function walk(dir, ext, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, ext, out); else if (ext.some(e => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}
const jsFiles = walk(root, ['.js']);
const viewFiles = walk(path.join(root, 'views'), ['.ejs']);

test('every JavaScript file parses', () => {
  const broken = [];
  for (const file of jsFiles) {
    try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); } catch { broken.push(path.relative(root, file)); }
  }
  assert.deepStrictEqual(broken, []);
});

test('the app module loads with all routes', () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'.repeat(40);
  const app = require('../index.js');
  assert.strictEqual(typeof app, 'function');
});

test('server messages never use the generic escaped error placeholder', () => {
  const placeholder = '\\u062d\\u062f\\u062b \\u062e\\u0637\\u0623';
  const offenders = walk(root, ['.js']).filter(f => /[\\/](controller|middlware|utiles|routes|rendering)[\\/]/.test(f))
    .filter(f => fs.readFileSync(f, 'utf8').includes(placeholder)).map(f => path.relative(root, f));
  assert.deepStrictEqual(offenders, []);
});

test('no Arabic text was replaced by question marks in views or client scripts', () => {
  const files = [...viewFiles, ...walk(path.join(root, 'public'), ['.js'])];
  const offenders = files.filter(f => /['">]\?{3,}[ '"<?]/.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(root, f));
  assert.deepStrictEqual(offenders, []);
});

test('every script tag in every view is closed', () => {
  const offenders = viewFiles.filter(f => {
    const s = fs.readFileSync(f, 'utf8');
    return (s.match(/<script\b/g) || []).length !== (s.match(/<\/script>/g) || []).length;
  }).map(f => path.relative(root, f));
  assert.deepStrictEqual(offenders, []);
});

test('public pages never read currentUser without checking it exists', () => {
  const publicViews = ['views/dish/dish.ejs', 'views/kitchen/kitchen.ejs', 'views/index.ejs', 'views/customer/dishes.ejs', 'views/customer/kitchens.ejs', 'views/partials/header.ejs', 'views/partials/footer.ejs'];
  const offenders = [];
  for (const rel of publicViews) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    for (const tag of fs.readFileSync(file, 'utf8').match(/<%[^%]*currentUser\.[^%]*%>/g) || []) {
      if (!/currentUser\s*&&|currentUser\s*\?|typeof currentUser/.test(tag)) offenders.push(rel + ': ' + tag.slice(0, 80));
    }
  }
  assert.deepStrictEqual(offenders, []);
});

test('kitchen order query exposes no customer data', () => {
  const src = fs.readFileSync(path.join(root, 'controller/orders.js'), 'utf8');
  const chef = src.slice(src.indexOf('async function getChefOrders_controller'), src.indexOf('async function listOrdersAdmin_controller'));
  assert.ok(chef.length > 50, 'chef query not found');
  for (const column of ['customer_name', 'customer_phone', 'customer_address', 'order_name', 'customer_id']) assert.ok(!chef.includes(column), column + ' reaches the kitchen');
});

test('delivery order query carries what the courier needs', () => {
  const src = fs.readFileSync(path.join(root, 'controller/orders.js'), 'utf8');
  const courier = src.slice(src.indexOf('async function getDeliveryOrders_controller'), src.indexOf('async function getChefOrders_controller'));
  for (const column of ['customer_phone', 'order_name', 'kitchen_phone', 'kitchen_address', 'dish_name', 'unit_price', 'total_price']) assert.ok(courier.includes(column), column + ' missing for delivery');
});
