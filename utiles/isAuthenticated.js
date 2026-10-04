module.exports = async (req) => require('../utiles/remove_password')(await require('../middlware/auth').identify(req));
