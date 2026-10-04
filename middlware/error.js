/**
 * Centralized Express error handler.
 * Maps error codes to HTTP status codes, logs server errors, and renders
 * appropriate error pages (HTML) or JSON responses based on request type.
 */
const checkLogin = require('../utiles/checkLogin');

const SERVER_MESSAGE = 'حصل عطل عندنا. جرب تاني بعد شوية';

/**
 * Express error-handling middleware (4-arity).
 * @param {Error} error - The error passed from upstream middleware/handlers.
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 * @param {Function} next - Next middleware (called if headers already sent).
 */
module.exports = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  // Map known error codes to HTTP status
  const status = error.status
    || (error.code === 'ER_DUP_ENTRY' ? 409
    : error.code === 'LIMIT_FILE_SIZE' ? 413
    : 500);

  // Friendly Arabic message for server errors; original message for client errors
  const message = status >= 500 ? SERVER_MESSAGE : error.message || SERVER_MESSAGE;

  // Log server errors (5xx) with structured JSON
  if (status >= 500) {
    console.error(JSON.stringify({
      event: 'request_failed',
      path: req.path,
      method: req.method,
      category: error.code || error.name || 'unknown'
    }));
  }
  // Optionally log stack in debug mode
  if (status >= 500 && process.env.DOQ_DEBUG_ERRORS === 'true' && process.env.NODE_ENV !== 'production') {
    console.error(error.stack);
  }

  // Detect if client wants an HTML page (GET, non-API, accepts HTML)
  const wantsPage = req.method === 'GET'
    && !req.path.includes('/api')
    && req.accepts(['html', 'json']) === 'html';

  if (wantsPage) {
    // Select error view by status code
    const view = status === 404 ? './errors/page_404'
      : status === 403 ? './errors/page_403'
      : './errors/page_500';
    return res.status(status).render(view, { message, ...checkLogin(req) });
  }

  // JSON response for API clients
  res.status(status).json({ status: 'error', message });
};