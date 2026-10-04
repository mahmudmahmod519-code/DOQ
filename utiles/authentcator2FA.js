const speakeasy = require('speakeasy');


function generateSecret() {
    const secret = speakeasy.generateSecret({
        name: `DOQ-Platform-${Date.now()}`,
        length: 20
    });
    return {
        base32: secret.base32,
        otpauth_url: secret.otpauth_url
    };
}


function verifyTokenStep(secret, token) {
    if (!secret || !/^\d{6}$/.test(String(token || ''))) return null;
    const result = speakeasy.totp.verifyDelta({ secret, encoding: 'base32', token: String(token), window: 1 });
    return result ? Math.floor(Date.now() / 30000) + result.delta : null;
}

function verifyToken(secret, token) {
    return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 1 // يسمح بفرق ثانية واحدة
    });
}

module.exports = {
    generateSecret,
    verifyToken,
    verifyTokenStep
};