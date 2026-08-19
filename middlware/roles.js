module.exports=(...roles)=>{
    return async(req,res,next)=>{
        if(!roles.includes(req.user.roles))return res.status(403).json({ message: "Forbidden: You don't have permission" });
        next();
    }
}