/**
 * MySQL query analyzer using EXPLAIN.
 * Runs EXPLAIN on the given query, executes it for timing, and returns
 * a structured analysis with issues, recommendations, and performance status.
 */
const pool = require('../database/pool');

/**
 * Analyzes a SQL query for performance issues.
 * @param {string} query - SQL query to analyze.
 * @param {Array} [params=[]] - Query parameters.
 * @returns {Promise<Object>} Analysis object with:
 *   - executionTime: ms to run the query
 *   - explain: EXPLAIN result rows
 *   - issues: array of detected problems (full scans, filesort, etc.)
 *   - recommendations: array of suggested fixes
 *   - status: performance rating string
 *   - usedIndexes: list of indexes used or '❌ لا يوجد فهارس مستخدمة'
 *   - error: present if analysis failed
 */
module.exports = async function analyzeQuery(query, params = []) {
    try {
        // 1. Run EXPLAIN
        const explainQuery = `EXPLAIN ${query}`;
        const [explainResult] = await pool.query(explainQuery, params);

        // 2. Execute query for timing
        const startTime = Date.now();
        const [data] = await pool.query(query, params);
        const executionTime = Date.now() - startTime;

        // 3. Build analysis object
        const analysis = {
            executionTime,
            explain: explainResult,
            issues: [],
            recommendations: []
        };

        // 4. Analyze EXPLAIN output per table
        explainResult.forEach(row => {
            // Full table scan
            if (row.type === 'ALL') {
                analysis.issues.push(`⚠️ جدول ${row.table} يستخدم فحص كامل (بدون فهرس)`);
                analysis.recommendations.push(`💡 أضف فهرس على العمود المستخدم في ${row.table}`);
            }

            // High row count
            if (row.rows > 10000) {
                analysis.issues.push(`⚠️ جدول ${row.table} يفحص ${row.rows} صف (كثير جداً)`);
                analysis.recommendations.push(`💡 حسّن الفهارس أو قلل JOINات`);
            }

            // Using filesort
            if (row.Extra && row.Extra.includes('Using filesort')) {
                analysis.issues.push(`⚠️ ${row.table} يستخدم filesort (ترتيب بدون فهرس)`);
                analysis.recommendations.push(`💡 أضف فهرس على عمود ORDER BY`);
            }

            // Using temporary
            if (row.Extra && row.Extra.includes('Using temporary')) {
                analysis.issues.push(`⚠️ ${row.table} يستخدم جدول مؤقت (مكلف)`);
                analysis.recommendations.push(`💡 حاول تقليل GROUP BY أو DISTINCT غير الضروري`);
            }

            // No index used
            if (!row.key || row.key === 'NULL') {
                analysis.issues.push(`⚠️ ${row.table} لا يستخدم أي فهرس`);
                analysis.recommendations.push(`💡 أضف فهرس على العمود ${row.possible_keys || 'المستخدم في WHERE'}`);
            }
        });

        // 5. Performance rating
        if (executionTime < 100) {
            analysis.status = '✅ ممتاز';
        } else if (executionTime < 500) {
            analysis.status = '👍 جيد';
        } else if (executionTime < 1000) {
            analysis.status = '⚠️ بطيء (يحتاج تحسين)';
        } else {
            analysis.status = '🚨 خطير (بطيء جداً)';
        }

        // 6. Collect used indexes
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
};