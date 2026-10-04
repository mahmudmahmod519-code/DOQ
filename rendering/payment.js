/**
 * Payment page rendering handler (chef).
 * Route: GET /payment
 */
const checkLogin = require("../utiles/checkLogin");
const { paymentsEnabled } = require('../controller/payment');

/**
 * Renders the chef payment page with payment settings.
 * @param {Object} req - Express request.
 * @param {Object} res - Express response.
 */
async function payment_render(req, res) {
    res.render('./chef/payment', {
        ...checkLogin(req, res),
        paymentsEnabled: paymentsEnabled(),
        payoutLink: process.env.PAYOUT_LINK || 'https://ipn.eg/S/mahmoudmustafamm/instapay/0qc4FA'
    });
}

module.exports = { payment_render };