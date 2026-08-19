// const logger=require("../startup/logging")

module.exports=(handler)=>{
    return async(req,res)=>{
        try{
            // console.log(req.path,req.method);
            await handler(req,res);
        }catch(ex){
            console.log(ex);
            console.log(ex.message);
            // change message ref of handler
            // req.path and req.method
            // add message here in status switch message
            res.status(500).json({message:"Server Internal Error"});
        }
    }
}