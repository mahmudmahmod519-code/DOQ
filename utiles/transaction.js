/**
 * Database transaction helper.
 * Acquires a connection, begins a transaction, runs the action, commits on success,
 * rolls back on error, and always releases the connection.
 * @param {Function} action - Async function(connection) => Promise<any> that runs within the transaction.
 * @returns {Promise<any>} Result of the action.
 * @throws {Error} Re-throws any error from the action after rollback.
 */
const pool = require('../database/pool');

module.exports = async function transaction(action) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await action(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};