/**
 * Joi validation helper.
 * Validates `data` against `schema` and either returns the validated value
 * or sends a 400 JSON response with the first error message.
 * @param {Joi.Schema} schema - Joi schema to validate against.
 * @param {Object} data - Data to validate (typically req.body, req.query, or req.params).
 * @param {Object} res - Express response (used to send 400 on failure).
 * @returns {Object|undefined} Validated value on success; undefined if response sent.
 */
module.exports = (schema, data, res) => {
    const { error, value } = schema.validate(data);

    if (error)
        return res.status(400).json({ message: error.details[0].message, status: "error" });

    return value;
};