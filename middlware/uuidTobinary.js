const { uuidToBinary } = require("../utiles/uuid");



module.exports= (req,res,next) => {
    req.params.id = uuidToBinary(req.params.id);
    next();
}
