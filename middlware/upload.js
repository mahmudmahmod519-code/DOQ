const multer=require("multer");
const fs = require("fs");

const uploadDir = './public/upload';

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage=multer.diskStorage({
    destination:(req,file,cb)=>{    
    if(file.mimetype.startsWith("image"))cb(null,uploadDir)
    else{cb(new Error("type not image"), false)};

},filename:(req,file,cb)=>{
    cb(null,`${Date.now()}-${file.originalname}`);
}})


module.exports=multer({
    storage
    ,limits:{fileSize: 5 * 1024 * 1024}
    ,fileFilter:(req,file,cb)=>{
        if (file.mimetype.startsWith('image/')) 
            cb(null, true);
        else 
            cb(new Error("this file is not image"), false);
        
}});