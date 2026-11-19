/**
 * Cursor (keyset) pagination helpers used by the mobile customer API.
 *
 * Instead of page/offset (which gets slower on deep pages and skips/duplicates rows when new
 * rows are inserted while the user is scrolling), every list is ordered by a stable key
 * (usually the row id DESC) and the client sends back an opaque `cursor` that encodes the
 * last key it has seen. The next query simply continues "after" that key.
 *
 * Response shape: { items: [...], next_cursor: string|null, has_more: boolean }
 */

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;

/**
 * Encodes a key object into an opaque URL-safe cursor string.
 * @param {Object} key - e.g. { id: 42 } or { t: '2026-01-01T00:00:00.000Z', id: 7 }.
 * @returns {string}
 */
function encodeCursor(key) {
    return Buffer.from(JSON.stringify(key), 'utf8').toString('base64url');
}

/**
 * Decodes a cursor produced by encodeCursor. Invalid/forged cursors return null
 * (the caller then starts from the first page instead of failing).
 * @param {string} value - Cursor string from the query.
 * @returns {Object|null}
 */
function decodeCursor(value) {
    if (!value || typeof value !== 'string' || value.length > 200) return null;
    try {
        const key = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
        if (!key || typeof key !== 'object' || Array.isArray(key)) return null;
        if (key.id !== undefined && !(Number.isSafeInteger(Number(key.id)) && Number(key.id) > 0)) return null;
        if (key.t !== undefined && Number.isNaN(new Date(key.t).getTime())) return null;
        return key;
    } catch {
        return null;
    }
}

/**
 * Normalises the requested page size.
 * @param {any} value - Raw ?limit= value.
 * @returns {number} Integer between 1 and MAX_LIMIT.
 */
function parseLimit(value) {
    const n = parseInt(value, 10);
    if (!Number.isInteger(n) || n < 1) return DEFAULT_LIMIT;
    return Math.min(n, MAX_LIMIT);
}

/**
 * Builds the API page from rows fetched with LIMIT (limit + 1).
 * The extra row only tells us whether another page exists; it is not returned.
 * @param {Array} rows - Rows fetched with LIMIT limit+1.
 * @param {number} limit - Requested page size.
 * @param {Function} keyOf - Maps the last returned row to its cursor key object.
 * @returns {{items: Array, next_cursor: string|null, has_more: boolean}}
 */
function buildPage(rows, limit, keyOf) {
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    return {
        items,
        next_cursor: hasMore && last ? encodeCursor(keyOf(last)) : null,
        has_more: hasMore
    };
}

module.exports = { encodeCursor, decodeCursor, parseLimit, buildPage, DEFAULT_LIMIT, MAX_LIMIT };
