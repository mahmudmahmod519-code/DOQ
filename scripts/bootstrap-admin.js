/**
 * Creates a single privileged admin account during first-time setup.
 * Reads ADMIN_BOOTSTRAP_* environment variables; fails fast if any are missing or invalid.
 * The admin is created with 2FA enabled and a sealed TOTP secret.
 */
require('../config/env');
const bcrypt = require('bcrypt');
const pool = require('../database/pool');
const { seal } = require('../utiles/session');

/**
 * Runs the admin bootstrap process.
 * Validates all required env vars, checks for duplicates, hashes the password,
 * and inserts the admin user with sealed TOTP secret.
 * @returns {Promise<void>}
 * @throws {Error} If required env vars are missing, invalid, or admin already exists.
 */
async function run() {
  const email = String(process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_BOOTSTRAP_PASSWORD || '');
  const firstName = String(process.env.ADMIN_BOOTSTRAP_FIRST_NAME || 'DOQ').trim();
  const lastName = String(process.env.ADMIN_BOOTSTRAP_LAST_NAME || 'Admin').trim();
  const phone = String(process.env.ADMIN_BOOTSTRAP_PHONE || '').trim();
  const totp = String(process.env.ADMIN_BOOTSTRAP_TOTP_SECRET || '').trim().toUpperCase();

  if (!email || !password || !phone || !totp) {
    throw new Error('admin_bootstrap_requires_email_password_phone_and_totp');
  }

  if (
    !/^[^@]+@[^@]+\.[^@]+$/.test(email) ||
    password.length < 8 ||
    !/^(010|011|012|015)\d{8}$/.test(phone) ||
    !/^[A-Z2-7]{16,64}=*$/.test(totp)
  ) {
    throw new Error('admin_bootstrap_values_invalid');
  }

  const [[existing]] = await pool.query('SELECT id FROM users WHERE email=? LIMIT 1', [email]);
  const hash = await bcrypt.hash(password, 12);

  if (existing) {
    throw new Error('admin_bootstrap_email_already_exists_use_admin_settings');
  }

  await pool.query(
    "INSERT INTO users (first_name,last_name,email,password_hash,phone_number,roles,account_status,two_factor_secret,two_factor_enabled,two_factor_required) VALUES (?,?,?, ?,?,'admin','approved',?,1,1)",
    [firstName, lastName, email, hash, phone, `sealed:${seal({ secret: totp })}`]
  );

  console.log('admin_bootstrap_complete');
}

if (require.main === module) {
  run()
    .then(() => pool.end())
    .catch(error => {
      console.error(error.message);
      process.exitCode = 1;
      pool.end();
    });
}

module.exports = { run };