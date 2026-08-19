const jwt = require("jsonwebtoken");
const pool=require("../database/pool");


async function isAuthenticated(req, res) {
    const token = req.cookies.session_token;

    let user=undefined;
    if (token) {
        const decode=jwt.verify(token,process.env.JWT_SECRET);
        if(!decode)return res.redirect("/");

        const [results]=await pool.query("SELECT * FROM users WHERE id = ?",[decode.id]);
        console.log(results);
        if(results.length===0)return undefined;
        let {password_hash,...data} = results[0];
        user=data;
    }
    
    return user
}

module.exports=isAuthenticated