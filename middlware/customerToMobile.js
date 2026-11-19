/**
 * Customer-facing web pages now live in the mobile app (/m).
 * For GET page requests from guests or customers, redirect to the matching /m page.
 * Staff roles (admin / chef / delivery) keep using the web pages untouched.
 * Must run after auth / auth.optional so req.user is populated.
 * @param {string|Function} target - Mobile path, or (req) => path.
 * @returns {Function} Express middleware.
 */
module.exports = (target) => (req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.user && req.user.roles !== 'customer') return next();
    const url = typeof target === 'function' ? target(req) : target;
    return res.redirect(302, url);
};
