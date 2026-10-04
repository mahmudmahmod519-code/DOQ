const checkLogin = require('../utiles/checkLogin');

function delivery_dashboard_render(req, res) {
  res.render('./delivery/dashboard', { ...checkLogin(req, res), pageTitle: 'مكتب التوصيل | دوق' });
}
module.exports = { delivery_dashboard_render };
