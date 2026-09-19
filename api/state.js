/* Cards account API — the sync half of an "account" for AP Decks, as a
 * Vercel serverless function backed by Vercel Blob.
 *
 *   GET /api/state -> { updatedAt, state }        + Bearer <account token>
 *   PUT /api/state <- { updatedAt, state }        + Bearer <account token>
 *
 * An account IS a token. Three ways a token is allowed, any one suffices:
 * SYNC_TOKEN in the project's environment holds the token itself (comma-
 * separated for more than one); SYNC_TOKEN_HASH holds sha256 hex of it; or
 * the token OWNS a deck — the first 16 hex of sha256('apdecks-owner:' + token)
 * matches an "owner" in data/index.json, the same derivation the app uses to
 * shelve a private deck, so the account that owns the Ladders syncs with no
 * secret configured anywhere. The API never mints tokens; a deployment with
 * none of the three refuses to sync at all.
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
var OWNER_SALT = 'apdecks-owner:';
var owners = [];
try {
  owners = (require('../data/index.json').courses || [])
    .map(function (c) { return c && c.owner; })
    .filter(function (o) { return typeof o === 'string' && /^[0-9a-f]{16}$/.test(o); });
} catch (e) { owners = []; }
// "configured" means both halves exist: someone is allowed, and there is a
// Blob store to write to. Without the store the app would see every push
// fail as a network error; with this it is told, truthfully, that sync is
// off on this deployment.
// What a 503 lacks, named, so the app and whoever reads the response can
// say so instead of guessing: 'store' = no Blob store is linked to this
// deployment, 'allowlist' = no token would be accepted anyway.
// A connected Blob store reaches the function one of two ways. The older
// connection injects BLOB_READ_WRITE_TOKEN (or <PREFIX>_READ_WRITE_TOKEN
// under a custom prefix); the current one injects only BLOB_STORE_ID and
// lets the SDK authenticate with the deployment's own OIDC token. Either is
// the store. A read-write token is passed explicitly when there is one;
// otherwise the call is left to the SDK, which pairs BLOB_STORE_ID with the
// OIDC token on its own.
function storeToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  var k = Object.keys(process.env).filter(function (x) { return /_READ_WRITE_TOKEN$/.test(x) && process.env[x]; }).sort()[0];
  return k ? process.env[k] : '';
}
function storeReady() { return !!(storeToken() || process.env.BLOB_STORE_ID); }
function blobOpts(extra) {
  var o = extra || {};
  var t = storeToken();
  if (t) o.token = t;
  return o;
}
function missing() {
  var m = [];
  if (!(split(process.env.SYNC_TOKEN).length + split(process.env.SYNC_TOKEN_HASH).length + owners.length)) m.push('allowlist');
  if (!storeReady()) m.push('store');
  return m;
}
function configured() { return missing().length === 0; }
function allowed(tok) {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(tok)) return false;
  var h = sha256(tok), o = sha256(OWNER_SALT + tok).slice(0, 16);
  return split(process.env.SYNC_TOKEN).some(function (t) { return eq(t, tok); }) ||
         split(process.env.SYNC_TOKEN_HASH).some(function (x) { return eq(x.toLowerCase(), h); }) ||
         owners.some(function (x) { return eq(x, o); });
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
  if (!configured()) return send(res, 503, { error: 'sync not configured', missing: missing() });

  var auth = req.headers.authorization || '';
  var tok = auth.indexOf('Bearer ') === 0 ? auth.slice(7).trim() : '';
  if (!allowed(tok)) return send(res, 401, { error: 'bad token' });

  var pathname = 'apdecks/' + sha256(tok) + '.json';

  if (req.method === 'GET') {
    try {
      var meta = await blob.head(pathname, blobOpts());
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
    await blob.put(pathname, text, blobOpts({
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    }));
    return send(res, 200, { ok: true, updatedAt: +body.updatedAt || Date.now() });
  } catch (e) {
    // the SDK's message names what is wrong with the store ("No blob
    // credentials found", "OIDC is enabled ... not for this environment"),
    // and none of it is secret; without it a failed push is a shrug
    return send(res, 500, { error: 'store failed', why: String(e && e.message || e).slice(0, 200) });
  }
};

// for the tests: the checks, and the owner list they read
module.exports.allowed = allowed;
module.exports.configured = configured;
module.exports.owners = owners;
module.exports.missing = missing;
