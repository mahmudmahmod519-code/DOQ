const multer=require("multer");
const fs = require("fs");
const crypto = require('crypto');
const path = require('path');

const uploadDir = './public/upload';

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage=multer.diskStorage({
    destination:(req,file,cb)=>{    
    if(file.mimetype.startsWith("image"))cb(null,uploadDir)
    else{cb(new Error("type not image"), false)};

},filename:(req,file,cb)=>{
    const extension = path.extname(file.originalname || '').toLowerCase();
    const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
    cb(null,`${crypto.randomBytes(18).toString('hex')}${allowed.has(extension) ? extension : '.img'}`);
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
