/**
 * Role-based authorization middleware factory.
 * Restricts access to routes based on the authenticated user's role.
 */

/**
 * Creates middleware that allows only the specified roles.
 * @param {...string} allowed - One or more role strings (e.g., 'admin', 'chef', 'delivery', 'customer').
 * @returns {Function} Express middleware: (req, res, next) => void.
 */
module.exports = (...allowed) => (req, res, next) => {
  if (!req.user || !allowed.includes(req.user.roles)) {
    return res.status(403).json({status: 'error', message: 'مش مسموح لحسابك بالعملية دي'});
  }
  next();
};