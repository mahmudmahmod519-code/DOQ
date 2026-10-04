// Sends queued rows from email_outbox through the SMTP settings in .env.
// Nothing is sent while the settings are missing or still hold the sample values; rows wait in the queue.
const nodemailer = require('nodemailer');
const pool = require('../database/pool');

const PLACEHOLDERS = new Set(['', 'your-email@gmail.com', 'your-app-password']);
function configured() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS) && !PLACEHOLDERS.has(SMTP_USER) && !PLACEHOLDERS.has(SMTP_PASS);
}

let transport;
function getTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    });
  }
  return transport;
}

let running = false;
async function flushOutbox(limit = 20) {
  if (running) return { status: 'busy' };
  if (!configured()) return { status: 'smtp_not_configured' };
  running = true;
  let sent = 0, failed = 0;
  try {
    const [rows] = await pool.query('SELECT id, recipient, subject, body, html_body FROM email_outbox WHERE sent_at IS NULL AND attempts < 5 ORDER BY id LIMIT ?', [limit]);
    for (const row of rows) {
      try {
        await getTransport().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: row.recipient, subject: row.subject, text: row.body, html: row.html_body || undefined });
        await pool.query('UPDATE email_outbox SET sent_at = UTC_TIMESTAMP(), attempts = attempts + 1 WHERE id = ?', [row.id]);
        sent++;
      } catch (error) {
        await pool.query('UPDATE email_outbox SET attempts = attempts + 1 WHERE id = ?', [row.id]);
        console.error('mail_send_failed', row.id, error && error.code);
        failed++;
      }
    }
  } finally { running = false; }
  return { status: 'done', sent, failed };
}

module.exports = { configured, flushOutbox };
