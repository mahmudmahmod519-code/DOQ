/**
 * Health check API.
 *   GET /health          -> liveness (process is up). No DB call, never flaps.
 *   GET /health/ready    -> readiness (DB reachable). 200 when ready, 503 when not.
 *   GET /api/v1/health   -> detailed status for monitoring dashboards / uptime robots.
 * None of these responses expose secrets, hostnames or connection strings.
 */
const router = require('express').Router();
const pool = require('../database/pool');
const pkg = require('../package.json');

const DB_TIMEOUT_MS = Number(process.env.HEALTH_DB_TIMEOUT_MS || 2000);

/**
 * Pings MySQL with a hard timeout.
 * @returns {Promise<{ok: boolean, latency_ms: number, error?: string}>}
 */
async function checkDatabase() {
    const started = Date.now();
    let timer;
    try {
        await Promise.race([
            pool.query('SELECT 1 AS ok'),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS); })
        ]);
        return { ok: true, latency_ms: Date.now() - started };
    } catch (error) {
        return { ok: false, latency_ms: Date.now() - started, error: error.message === 'timeout' ? 'timeout' : (error.code || 'unavailable') };
    } finally {
        clearTimeout(timer);
    }
}

function base() {
    return {
        service: 'doq',
        version: pkg.version,
        environment: process.env.NODE_ENV || 'development',
        uptime_seconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
    };
}

router.get('/health', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

router.get('/health/ready', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const database = await checkDatabase();
    res.status(database.ok ? 200 : 503).json({ status: database.ok ? 'ok' : 'unavailable', database });
});

router.get('/api/v1/health', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const database = await checkDatabase();
    const memory = process.memoryUsage();
    res.status(database.ok ? 200 : 503).json({
        status: database.ok ? 'ok' : 'degraded',
        ...base(),
        checks: {
            database,
            memory_mb: { rss: Math.round(memory.rss / 1048576), heap_used: Math.round(memory.heapUsed / 1048576) }
        }
    });
});

router.checkDatabase = checkDatabase;
module.exports = router;
