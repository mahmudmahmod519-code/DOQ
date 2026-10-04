/**
 * Authentication middleware for DOQ.
 * Verifies JWT session tokens from Authorization header or cookie, loads the user,
 * and attaches to req.user. Provides required and optional variants.
 */
const jwt = require('jsonwebtoken');
const pool = require('../database/pool');
const HttpError = require('../utiles/httpError');

/**
 * Extracts and verifies a session JWT, then loads the user from the database.
 * Checks session_version to invalidate old sessions, enforces 2FA requirements.
 * @param {Object} req - Express request; reads cookies.session_token or Authorization header.
 * @returns {Promise<Object|null>} User row or null if no valid session.
 */
async function identify(req) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : req.cookies?.session_token;
  if (!token) return null;

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
  if (!payload.id || payload.type !== 'session') return null;

  const [[user]] = await pool.query('SELECT * FROM users WHERE id=?', [payload.id]);
  if (!user || Number(payload.sv || 0) !== Number(user.session_version || 0) || user.account_status !== 'approved') return null;
  if (Number(user.two_factor_required) && !Number(user.two_factor_enabled)) return null;

  return user;
}

/**
 * Required authentication middleware.
 * If a valid session exists, attaches req.user and calls next().
 * Otherwise responds 401 (JSON for API/non-GET, redirect to /auth for HTML GET).
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 * @param {Function} next - Next middleware.
 */
async function auth(req, res, next) {
  try {
    req.user = await identify(req);
    if (req.user) return next();
    if (req.path.includes('/api') || req.get('accept')?.includes('application/json') || req.method !== 'GET') {
      return res.status(401).json({status: 'error', message: 'سجل دخول الأول'});
    }
    return res.redirect('/auth');
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware.
 * Attaches req.user if a valid session exists; never blocks the request.
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 * @param {Function} next - Next middleware.
 */
auth.optional = async (req, res, next) => {
  try {
    req.user = await identify(req);
    next();
  } catch (error) {
    next(error);
  }
};

auth.identify = identify;

module.exports = auth;