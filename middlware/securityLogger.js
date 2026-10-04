//use to protect form xss and sqlInjection and code injection

// middleware/securityLogger.js
const fs = require('fs');
const path = require('path');

module.exports = (req, res, next) => {
    const startTime = Date.now();
    
    // تسجيل الطلبات المشبوهة فقط
    const suspiciousPatterns = [
        /\.\.\//, // محاولة الوصول لملفات خارجية
        /union\s+select/i, // SQL Injection
        /<script/i, // XSS
        /eval\(/i // Code Injection
    ];
    
    const isSuspicious = suspiciousPatterns.some(pattern => 
        pattern.test(req.url) || pattern.test(JSON.stringify(req.body))
    );
    
    if (isSuspicious) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            ip: req.ip,
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: req.body,
            userAgent: req.headers['user-agent']
        };
        
        // تسجيل في ملف
        fs.appendFileSync(
            path.join(__dirname, '../logs/suspicious.log'),
            JSON.stringify(logEntry) + '\n'
        );
        
        // إرسال تنبيه (يمكن إرسال إيميل أو Telegram)
        console.warn('⚠️ Suspicious request detected:', logEntry);
    }
    
    next();
};