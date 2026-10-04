/**
 * Middleware that converts a UUID string parameter to binary(16) format.
 * Uses uuidToBinary utility; mutates req.params.id in place.
 */
const { uuidToBinary } = require("../utiles/uuid");

/**
 * Express middleware: converts req.params.id from UUID string to binary.
 * @param {Object} req - Express request; mutates req.params.id.
 * @param {Object} res - Express response.
 * @param {Function} next - Next middleware.
 */
module.exports = (req, res, next) => {
    req.params.id = uuidToBinary(req.params.id);
    next();
};