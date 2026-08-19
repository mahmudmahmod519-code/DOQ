const jwt=require("jsonwebtoken");
const pool=require("../database/pool");

module.exports=async(req,res,next)=>{
    const token=req.cookies.session_token;
    
    if(!token)return res.redirect("/auth");
    try{
        const decode=jwt.verify(token,process.env.JWT_SECRET);
        if(!decode)return res.redirect("/");
        
        const [result]=await pool.query("SELECT * FROM users WHERE id= ? ",[decode.id]);
        req.user=result[0];
        next();
    }catch(ex){
        // logger.info(ex);
        console.log(ex);
    }
}