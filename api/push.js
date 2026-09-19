/* Cards push API — the reminder half of an "account" for AP Decks, as a
 * Vercel serverless function backed by Vercel Blob.
 *
 *   GET    /api/push -> { publicKey, configured }
 *   POST   /api/push <- { sub, tz, dueOn }       + Bearer <account token>, optional
 *   DELETE /api/push <- { endpoint }
 *
 * A device that turns reminders on hands over its push subscription, its
 * time zone and a projection of how many cards fall due on each of the
 * coming days. That is one record per device under
 * apdecks/push/<sha256(endpoint)>.json; push-send.js reads them all once a
 * day and nudges the devices with something due. The account token is
 * optional: presented and allowed, it tags the record with the account so
 * every device of that account can share whichever projection is freshest;
 * a token that is not allowed simply tags nothing, because a reminder is
 * not worth refusing over. The endpoint is the only thing that names a
 * record, so a device can always delete its own and nothing else.
 */

var crypto = require('crypto');
var blob = require('@vercel/blob');

var MAX_DAYS = 60;      // the app projects a couple of months ahead at most
var MAX_ENDPOINT = 2048; // push endpoints run a few hundred chars; this is generous

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
// "configured" means a VAPID key pair to sign pushes with and a Blob store
// to keep the subscriptions in. Without both the app is told, truthfully,
// that reminders are off on this deployment instead of watching a
// subscribe fail as a network error.
function configured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && storeReady());
}
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

function recordPath(endpoint) { return 'apdecks/push/' + sha256(endpoint) + '.json'; }

// the stored record, or null when there is none (or it cannot be read —
// for a subscribe that only costs the remembered `sent` day)
async function readRecord(pathname) {
  try {
    var meta = await blob.head(pathname, blobOpts());
    if (!meta || !meta.url) return null;
    // the public blob URL rides a CDN — a unique query skips its cache so
    // a re-subscribe right after a send sees the day the send wrote
    var r = await fetch(meta.url + '?fresh=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return null;
    var stored = await r.json();
    return stored && typeof stored === 'object' ? stored : null;
  } catch (e) {
    return null;
  }
}

function goodEndpoint(v) {
  if (typeof v !== 'string' || !v || v.length >= MAX_ENDPOINT) return false;
  try { return new URL(v).protocol === 'https:'; } catch (e) { return false; }
}
function goodKey(v) { return typeof v === 'string' && v.length > 0 && v.length <= 512; }
// a zone the runtime can compute a local date in; anything else is UTC,
// which is a wrong hour for a reminder, not a refused subscription
function cleanZone(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return 'UTC';
  try { new Intl.DateTimeFormat(undefined, { timeZone: tz }); return tz; } catch (e) { return 'UTC'; }
}
// the projection: 'YYYY-MM-DD' -> how many due that day, the soonest days
// kept when a client sends more than fits
function cleanDueOn(v) {
  var out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  Object.keys(v).filter(function (k) {
    var n = v[k];
    return /^\d{4}-\d{2}-\d{2}$/.test(k) && typeof n === 'number' && Number.isInteger(n) && n >= 0;
  }).sort().slice(0, MAX_DAYS).forEach(function (k) { out[k] = v[k]; });
  return out;
}
function parseBody(body) {
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  if (req.method === 'GET') {
    return send(res, 200, { publicKey: process.env.VAPID_PUBLIC_KEY || '', configured: configured() });
  }
  if (req.method !== 'POST' && req.method !== 'DELETE') return send(res, 405, { error: 'method' });

  var body = parseBody(req.body);

  if (req.method === 'DELETE') {
    // a device turning reminders off needs only the store; a missing key
    // pair is no reason to keep its record around
    if (!storeReady()) return send(res, 503, { error: 'push not configured' });
    if (!body || !goodEndpoint(body.endpoint)) return send(res, 400, { error: 'bad endpoint' });
    try {
      await blob.del(recordPath(body.endpoint), blobOpts());
    } catch (e) {
      // a record that is already gone is the outcome asked for
    }
    return send(res, 200, { ok: true });
  }

  // POST
  if (!configured()) return send(res, 503, { error: 'push not configured' });
  var sub = body && body.sub;
  if (!sub || typeof sub !== 'object' || !goodEndpoint(sub.endpoint) ||
      !sub.keys || typeof sub.keys !== 'object' || !goodKey(sub.keys.p256dh) || !goodKey(sub.keys.auth)) {
    return send(res, 400, { error: 'bad subscription' });
  }
  var auth = req.headers.authorization || '';
  var tok = auth.indexOf('Bearer ') === 0 ? auth.slice(7).trim() : '';
  var acct = tok && allowed(tok) ? sha256(tok) : '';

  var pathname = recordPath(sub.endpoint);
  var prev = await readRecord(pathname);
  var record = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    tz: cleanZone(body.tz),
    acct: acct,
    dueOn: cleanDueOn(body.dueOn),
    at: Date.now(),
    // the day of the last reminder survives a re-subscribe, or a device
    // that re-posts its projection after studying would be nudged twice
    sent: prev && typeof prev.sent === 'string' ? prev.sent : '',
  };
  try {
    await blob.put(pathname, JSON.stringify(record), blobOpts({
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    }));
    return send(res, 200, { ok: true });
  } catch (e) {
    // the SDK's message names what is wrong with the store and none of it
    // is secret; without it a failed subscribe is a shrug
    return send(res, 500, { error: 'store failed', why: String(e && e.message || e).slice(0, 200) });
  }
};

// for the tests and for push-send.js: the checks and the record path
module.exports.configured = configured;
module.exports.allowed = allowed;
module.exports.recordPath = recordPath;
