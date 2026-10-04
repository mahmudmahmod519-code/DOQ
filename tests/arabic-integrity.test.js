const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const files = [
  'views/delivery/dashboard.ejs',
  'views/customer/orders.ejs',
  'views/chef/orders.ejs',
  'views/notifications.ejs',
  'views/auth/recovery.ejs',
  'views/auth/2fa.ejs',
  'views/admin/operations.ejs',
  'controller/auth.js',
  'controller/platform.js',
  'controller/orders.js',
  'tasks/cron.js',
  'routes/notifications.js',
  'routes/user.js'
];

test('Arabic source has no replacement runs or mojibake', () => {
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(source.includes('???'), false, file + ' contains replacement characters');
    assert.equal(/[ØÙ][\u0080-\u00ff]/.test(source), false, file + ' contains mojibake');
  }
});
