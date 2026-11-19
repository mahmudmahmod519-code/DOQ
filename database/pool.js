/**
 * MySQL connection pool for the DOQ application.
 * Reads DB_* environment variables, standard PaaS MYSQL* variables, or DATABASE_URL/MYSQL_URL,
 * and exports a ready-to-use pool.
 */
require('../config/env');
const mysql = require('mysql2/promise');

const connectionUri = process.env.DATABASE_URL || process.env.MYSQL_URL;
let host = process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1';
let user = process.env.DB_USER || process.env.MYSQLUSER || 'doq_user';
let password = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD);
let database = process.env.DB_NAME || process.env.MYSQLDATABASE || 'DOQ';
let port = Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306);

if (connectionUri) {
  try {
    const parsed = new URL(connectionUri);
    host = parsed.hostname;
    port = Number(parsed.port || 3306);
    user = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
    database = parsed.pathname.replace(/^\//, '');
  } catch {}
}

module.exports = mysql.createPool({
  host,
  user,
  password,
  database,
  port,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 100,
  connectTimeout: 5000,
  charset: 'utf8mb4',
  timezone: 'Z',
  decimalNumbers: false
});
