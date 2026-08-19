// const logger=require("../startup/logging");


module.exports=(err,req,res,next)=>{
    console.error(err.message);
    console.error(err);
    // logger.error(err.message);
    // logger.error(err);
    next();
}