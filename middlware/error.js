const checkLogin = require('../utiles/checkLogin');

const SERVER_MESSAGE = 'حصل عطل عندنا. جرب تاني بعد شوية';

module.exports = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status || (error.code === 'ER_DUP_ENTRY' ? 409 : error.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  const message = status >= 500 ? SERVER_MESSAGE : error.message || SERVER_MESSAGE;
  if (status >= 500) console.error(JSON.stringify({ event: 'request_failed', path: req.path, method: req.method, category: error.code || error.name || 'unknown' }));
  if (status >= 500 && process.env.DOQ_DEBUG_ERRORS === 'true' && process.env.NODE_ENV !== 'production') console.error(error.stack);
  const wantsPage = req.method === 'GET' && !req.path.includes('/api') && req.accepts(['html', 'json']) === 'html';
  if (wantsPage) {
    const view = status === 404 ? './errors/page_404' : status === 403 ? './errors/page_403' : './errors/page_500';
    return res.status(status).render(view, { message, ...checkLogin(req) });
  }
  res.status(status).json({ status: 'error', message });
};
