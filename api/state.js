/* Cards account API — the sync half of an "account" for AP Decks, as a
 * Vercel serverless function backed by Vercel Blob.
 *
 *   GET /api/state -> { updatedAt, state }        + Bearer <account token>
 *   PUT /api/state <- { updatedAt, state }        + Bearer <account token>
 *
 * An account IS a token. The allowed token is configured once, in the
 * project's environment: SYNC_TOKEN holds the token itself (comma-separated
 * for more than one), or SYNC_TOKEN_HASH holds sha256 hex of it. The API
 * never mints tokens; an unconfigured deployment refuses to sync at all.
 * State is one JSON blob per account under apdecks/<sha256(token)>.json;
 * the app merges, this function just stores.
 */

var crypto = require('crypto');
var blob = require('@vercel/blob');

var MAX_BYTES = 2 * 1024 * 1024; // a full state is ~200 KB; 2 MB is generous

function sha256(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }
function eq(a, b) {
  var ha = Buffer.from(sha256(String(a)), 'hex'), hb = Buffer.from(sha256(String(b)), 'hex');
  return crypto.timingSafeEqual(ha, hb);
}
function split(v) {
  return String(v || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}
function configured() { return split(process.env.SYNC_TOKEN).length + split(process.env.SYNC_TOKEN_HASH).length > 0; }
function allowed(tok) {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(tok)) return false;
  var h = sha256(tok);
  return split(process.env.SYNC_TOKEN).some(function (t) { return eq(t, tok); }) ||
         split(process.env.SYNC_TOKEN_HASH).some(function (x) { return eq(x.toLowerCase(), h); });
}
function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'GET' && req.method !== 'PUT') return send(res, 405, { error: 'method' });
  if (!configured()) return send(res, 503, { error: 'sync not configured' });

  var auth = req.headers.authorization || '';
  var tok = auth.indexOf('Bearer ') === 0 ? auth.slice(7).trim() : '';
  if (!allowed(tok)) return send(res, 401, { error: 'bad token' });

  var pathname = 'apdecks/' + sha256(tok) + '.json';

  if (req.method === 'GET') {
    try {
      var meta = await blob.head(pathname);
      if (!meta || !meta.url) return send(res, 200, { updatedAt: 0, state: null });
      // the public blob URL rides a CDN — a unique query skips its cache so
      // a pull right after a push on another device sees the fresh write
      var r = await fetch(meta.url + '?fresh=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return send(res, 200, { updatedAt: 0, state: null });
      var stored = await r.json();
      return send(res, 200, stored && typeof stored === 'object' ? stored : { updatedAt: 0, state: null });
    } catch (e) {
      // no blob yet is a first sync, not an error
      return send(res, 200, { updatedAt: 0, state: null });
    }
  }

  // PUT
  var body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object' || !body.state || typeof body.state !== 'object') {
    return send(res, 400, { error: 'bad state' });
  }
  var text = JSON.stringify({ updatedAt: +body.updatedAt || Date.now(), state: body.state });
  if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) return send(res, 413, { error: 'too big' });
  try {
    await blob.put(pathname, text, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    });
    return send(res, 200, { ok: true, updatedAt: +body.updatedAt || Date.now() });
  } catch (e) {
    return send(res, 500, { error: 'store failed' });
  }
};
