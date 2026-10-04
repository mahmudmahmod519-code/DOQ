const checkLogin = require("../utiles/checkLogin");

module.exports=(req,res)=>{
    res.status(404).render('./errors/page_404',checkLogin(req,res));
}