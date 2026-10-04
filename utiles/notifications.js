/**
 * Notification helpers for in-app notifications table.
 * Provides: notify() for single user, admins() for all admins.
 */
const pool = require('../database/pool');

/**
 * Inserts a notification for a user (deduplicated via dedupe_key).
 * Uses INSERT IGNORE so duplicate dedupe keys are silently skipped.
 * @param {Object} db - Database connection (pool or transaction connection).
 * @param {number} userId - Target user ID.
 * @param {string} type - Notification type string (e.g., 'delivery_daily_report').
 * @param {string} title - Notification title.
 * @param {string} body - Notification body text.
 * @param {string} [entityType=null] - Related entity type (e.g., 'order').
 * @param {number} [entityId=null] - Related entity ID.
 * @param {string} [dedupe=null] - Deduplication key to prevent duplicates.
 * @returns {Promise<void>}
 */
async function notify(db, userId, type, title, body, entityType = null, entityId = null, dedupe = null) {
  if (!userId) return;
  await db.query(
    'INSERT IGNORE INTO notifications (user_id,type,title,body,entity_type,entity_id,dedupe_key) VALUES (?,?,?,?,?,?,?)',
    [userId, type, title, body, entityType, entityId, dedupe]
  );
}

/**
 * Notifies all approved admin users.
 * Generates a dedupe key from type+entityType+entityId when provided.
 * @param {Object} db - Database connection (pool or transaction connection).
 * @param {string} type - Notification type.
 * @param {string} title - Notification title.
 * @param {string} body - Notification body.
 * @param {string} [entityType=null] - Related entity type.
 * @param {number} [entityId=null] - Related entity ID.
 * @returns {Promise<void>}
 */
async function admins(db, type, title, body, entityType = null, entityId = null) {
  const [rows] = await db.query("SELECT id FROM users WHERE roles='admin' AND account_status='approved'");
  for (const user of rows) {
    await notify(
      db,
      user.id,
      type,
      title,
      body,
      entityType,
      entityId,
      entityType && entityId ? `${type}:${entityType}:${entityId}` : null
    );
  }
}

module.exports = { notify, admins };