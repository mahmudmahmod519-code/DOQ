const pool = require('../database/pool');

module.exports=async function analyzeQuery(query, params = []) {
    try {
        // 1. تشغيل EXPLAIN
        const explainQuery = `EXPLAIN ${query}`;
        const [explainResult] = await pool.query(explainQuery, params);
        
        // 2. تشغيل الاستعلام الفعلي مع توقيت
        const startTime = Date.now();
        const [data] = await pool.query(query, params);
        const executionTime = Date.now() - startTime;
        
        // 3. تحليل النتائج
        const analysis = {
            executionTime,
            explain: explainResult,
            issues: [],
            recommendations: []
        };
        
        // 4. تحليل EXPLAIN
        explainResult.forEach(row => {
            // مشكلة: فحص كامل للجدول
            if (row.type === 'ALL') {
                analysis.issues.push(`⚠️ جدول ${row.table} يستخدم فحص كامل (بدون فهرس)`);
                analysis.recommendations.push(`💡 أضف فهرس على العمود المستخدم في ${row.table}`);
            }
            
            // مشكلة: عدد كبير من الصفوف
            if (row.rows > 10000) {
                analysis.issues.push(`⚠️ جدول ${row.table} يفحص ${row.rows} صف (كثير جداً)`);
                analysis.recommendations.push(`💡 حسّن الفهارس أو قلل JOINات`);
            }
            
            // مشكلة: Using filesort
            if (row.Extra && row.Extra.includes('Using filesort')) {
                analysis.issues.push(`⚠️ ${row.table} يستخدم filesort (ترتيب بدون فهرس)`);
                analysis.recommendations.push(`💡 أضف فهرس على عمود ORDER BY`);
            }
            
            // مشكلة: Using temporary
            if (row.Extra && row.Extra.includes('Using temporary')) {
                analysis.issues.push(`⚠️ ${row.table} يستخدم جدول مؤقت (مكلف)`);
                analysis.recommendations.push(`💡 حاول تقليل GROUP BY أو DISTINCT غير الضروري`);
            }
            
            // تحذير: لا يوجد فهرس مستخدم
            if (!row.key || row.key === 'NULL') {
                analysis.issues.push(`⚠️ ${row.table} لا يستخدم أي فهرس`);
                analysis.recommendations.push(`💡 أضف فهرس على العمود ${row.possible_keys || 'المستخدم في WHERE'}`);
            }
        });
        
        // 5. تقييم الأداء
        if (executionTime < 100) {
            analysis.status = '✅ ممتاز';
        } else if (executionTime < 500) {
            analysis.status = '👍 جيد';
        } else if (executionTime < 1000) {
            analysis.status = '⚠️ بطيء (يحتاج تحسين)';
        } else {
            analysis.status = '🚨 خطير (بطيء جداً)';
        }
        
        // 6. إضافة معلومات عن الفهارس المستخدمة
        const usedIndexes = explainResult
            .filter(row => row.key)
            .map(row => `${row.table}: ${row.key}`);
        
        analysis.usedIndexes = usedIndexes.length > 0 ? usedIndexes : ['❌ لا يوجد فهارس مستخدمة'];
        
        return analysis;
        
    } catch (error) {
        console.error('Error analyzing query:', error && error.message);
        return {
            error: error.message,
            status: '❌ فشل التحليل'
        };
    }
}
