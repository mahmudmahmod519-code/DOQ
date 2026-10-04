/**
 * Custom HTTP error class with status code and optional error code.
 * Extends Error; thrown in routes and caught by the central error middleware.
 */
class HttpError extends Error {
  /**
   * @param {number} status - HTTP status code (e.g., 400, 404, 409).
   * @param {string} message - Human-readable error message.
   * @param {string} [code] - Optional machine-readable error code (e.g., 'CSRF_INVALID').
   */
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
module.exports = HttpError;