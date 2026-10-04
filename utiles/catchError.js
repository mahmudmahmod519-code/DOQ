// Hands every async failure to the central error middleware so the real status (400, 403, 404, 409)
// reaches the client and nothing sensitive is printed here.
module.exports = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
