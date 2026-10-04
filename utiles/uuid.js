/**
 * UUID ↔ Binary(16) conversion utilities for MySQL.
 * MySQL stores UUIDs as BINARY(16) for performance; these functions convert between
 * the standard 36-char string format and the 16-byte Buffer format.
 */

/**
 * Converts a standard UUID string (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) to a Buffer(16).
 * @param {string} uuid - UUID string with or without hyphens.
 * @returns {Buffer|null} 16-byte Buffer or null if input is falsy.
 */
function uuidToBinary(uuid) {
    if (!uuid) return null;
    return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

/**
 * Converts a 16-byte binary value (Buffer or hex string) to a standard UUID string.
 * @param {Buffer|string} binary - 16-byte Buffer or 32-char hex string.
 * @returns {string|null} UUID string with hyphens, or null if input is falsy.
 */
function binaryToUuid(binary) {
    if (!binary) return null;
    const hex = Buffer.isBuffer(binary) ? binary.toString('hex') : binary;

    return [
        hex.substring(0, 8),
        hex.substring(8, 12),
        hex.substring(12, 16),
        hex.substring(16, 20),
        hex.substring(20, 32)
    ].join('-');
}

module.exports = {
    binaryToUuid,
    uuidToBinary
};