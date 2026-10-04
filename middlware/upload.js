/**
 * Multer configuration for image uploads.
 * Stores files under ./public/upload with random hex filenames.
 * Accepts only image MIME types (jpg, jpeg, png, webp, gif) up to 5 MB.
 */
const multer = require("multer");
const fs = require("fs");
const crypto = require('crypto');
const path = require('path');

const uploadDir = './public/upload';

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.mimetype.startsWith("image")) {
            cb(null, uploadDir);
        } else {
            cb(new Error("type not image"), false);
        }
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname || '').toLowerCase();
        const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
        // Random 18-byte hex name + allowed extension (fallback .img)
        cb(null, `${crypto.randomBytes(18).toString('hex')}${allowed.has(extension) ? extension : '.img'}`);
    }
});

/**
 * Configured multer instance for single/multiple image uploads.
 * Limits: 5 MB per file.
 * fileFilter: accepts only image/* MIME types.
 */
module.exports = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error("this file is not image"), false);
        }
    }
});