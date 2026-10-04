const removeSecrets = require('./remove_password');
module.exports = (req) => ({ currentUser: req.user ? removeSecrets(req.user) : undefined, status: 'success', login: Boolean(req.user) });
