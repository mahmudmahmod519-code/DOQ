require('../config/env');
const bcrypt = require('bcrypt');
const pool = require('../database/pool');

const accounts = [
  { key: 'customer', email: 'doq-test-customer@example.test', phone: '01000000001', role: 'customer', status: 'approved', first: 'عميل', last: 'اختبار' },
  { key: 'chef', email: 'doq-test-chef@example.test', phone: '01000000002', role: 'chef', status: 'pending', first: 'شيف', last: 'اختبار', company: 'مطبخ اختبار' },
  { key: 'delivery', email: 'doq-test-delivery@example.test', phone: '01000000003', role: 'delivery', status: 'pending', first: 'دليفري', last: 'اختبار', company: 'شركة توصيل اختبار' },
  { key: 'admin', email: 'doq-test-admin@example.test', phone: '01000000004', role: 'admin', status: 'approved', first: 'مدير', last: 'اختبار' }
];

async function run() {
  if (process.env.NODE_ENV === 'production') throw new Error('test_accounts_disabled_in_production');
  if (process.env.DOQ_ALLOW_TEST_ACCOUNTS !== 'true') throw new Error('set_DOQ_ALLOW_TEST_ACCOUNTS_true');
  const password = String(process.env.DOQ_TEST_PASSWORD || '');
  if (password.length < 12) throw new Error('DOQ_TEST_PASSWORD_must_be_at_least_12_characters');
  const hash = await bcrypt.hash(password, 12);
  const created = [];
  for (const account of accounts) {
    const [[existing]] = await pool.query('SELECT id FROM users WHERE email=? LIMIT 1', [account.email]);
    if (existing) throw new Error(`test_account_already_exists:${account.email}`);
    await pool.query(
      `INSERT INTO users (first_name,last_name,email,password_hash,phone_number,roles,account_status,company_name,two_factor_enabled,two_factor_required)
       VALUES (?,?,?,?,?,?,?, ?,0,0)`,
      [account.first, account.last, account.email, hash, account.phone, account.role, account.status, account.company || null]
    );
    created.push({ key: account.key, email: account.email, role: account.role, account_status: account.status });
  }
  console.log(JSON.stringify({ status: 'created', accounts: created }, null, 2));
}

if (require.main === module) run().then(() => pool.end()).catch(error => { console.error(error.message); pool.end().then(() => { process.exitCode = 1; }); });
module.exports = { run, accounts };
