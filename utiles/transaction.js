const pool = require('../database/pool');
module.exports = async function transaction(action) {
  const connection = await pool.getConnection();
  try { await connection.beginTransaction(); const result = await action(connection); await connection.commit(); return result; }
  catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
};
