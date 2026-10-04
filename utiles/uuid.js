
function uuidToBinary(uuid) {
    if (!uuid) return null;
    return Buffer.from(uuid.replace(/-/g, ''), 'hex'); // لازم يرجع Buffer
}

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