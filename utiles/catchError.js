/**
 * Async error wrapper for Express route handlers.
 * Forwards any rejected promise to the centralized error middleware
 * so the correct HTTP status (400, 403, 404, 409, 500) reaches the client
 * without leaking sensitive details here.
 * @param {Function} handler - Async route handler (req, res, next) => Promise.
 * @returns {Function} Express middleware that catches and forwards errors.
 */
module.exports = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);