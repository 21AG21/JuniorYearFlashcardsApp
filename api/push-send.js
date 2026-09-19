/* Cards reminder cron — once a day, tell each subscribed device how many
 * cards are due for it today, as a Vercel serverless function driven by
 * the schedule in vercel.json.
 *
 *   GET|POST /api/push-send -> { checked, sent, skipped, dropped, failed }
 *                              + Bearer <CRON_SECRET> when the project has one
 *
 * The records under apdecks/push/ are what push.js stored: a subscription,
 * a time zone, an account tag and a projection of due counts by day. The
 * cron fires at one UTC hour, so "today" is worked out per record in its
 * own zone and a record remembers the day it was last nudged; a device is
 * told once a day, and only on a day with something due. Devices that
 * share an account also share a projection: the one that posted last
 * studied last, so it knows the truth for all of them. A push service that
 * answers 404 or 410 has forgotten the subscription, and so does this.
 */

var crypto = require('crypto');
var blob = require('@vercel/blob');
var webpush = require('web-push');

var PREFIX = 'apdecks/push/';
var TTL = 6 * 3600; // a reminder that waits longer than an evening is stale

function sha256(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }
function eq(a, b) {
  var ha = Buffer.from(sha256(String(a)), 'hex'), hb = Buffer.from(sha256(String(b)), 'hex');
  return crypto.timingSafeEqual(ha, hb);
}
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
// the same "configured" push.js answers with: a key pair and a store
function configured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && storeReady());
}
function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

// today's date in a zone as 'YYYY-MM-DD'; the parts are assembled by hand
// so the answer does not depend on which locale data the runtime ships
function today(tz) {
  var when = new Date();
  var parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(when);
  } catch (e) {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(when);
  }
  function part(t) { return (parts.find(function (p) { return p.type === t; }) || {}).value || ''; }
  return part('year') + '-' + part('month') + '-' + part('day');
}

async function listRecords() {
  var blobs = [], cursor;
  do {
    var page = await blob.list(blobOpts({ prefix: PREFIX, cursor: cursor }));
    blobs = blobs.concat(page && page.blobs || []);
    cursor = page && page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}
async function readRecord(b) {
  // the public blob URL rides a CDN — a unique query skips its cache so a
  // projection posted minutes ago is the one read
  var r = await fetch(b.url + '?fresh=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) return null;
  var stored = await r.json();
  return stored && typeof stored === 'object' && typeof stored.endpoint === 'string' && stored.keys ? stored : null;
}
function gone(e) { return !!(e && (e.statusCode === 404 || e.statusCode === 410)); }

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'GET' && req.method !== 'POST') return send(res, 405, { error: 'method' });

  // Vercel Cron presents the project's CRON_SECRET as a bearer; with one
  // set, nobody else gets to fire a day's reminders early
  if (process.env.CRON_SECRET) {
    var auth = req.headers.authorization || '';
    var tok = auth.indexOf('Bearer ') === 0 ? auth.slice(7).trim() : '';
    if (!tok || !eq(tok, process.env.CRON_SECRET)) return send(res, 401, { error: 'unauthorized' });
  }
  if (!configured()) return send(res, 503, { error: 'push not configured' });
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://myfleshcards.vercel.app',
      process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  } catch (e) {
    // a key pair the library will not sign with is as good as none
    return send(res, 503, { error: 'push not configured' });
  }

  var counts = { checked: 0, sent: 0, skipped: 0, dropped: 0, failed: 0 };
  var blobs;
  try {
    blobs = await listRecords();
  } catch (e) {
    return send(res, 500, { error: 'store failed', why: String(e && e.message || e).slice(0, 200) });
  }

  var records = [];
  for (var i = 0; i < blobs.length; i++) {
    counts.checked++;
    try {
      var rec = await readRecord(blobs[i]);
      if (rec) records.push({ path: blobs[i].pathname, rec: rec });
      else counts.failed++;
    } catch (e) {
      counts.failed++;
    }
  }

  // the freshest projection of each account speaks for all of its devices
  var freshest = {};
  records.forEach(function (r) {
    var a = r.rec.acct;
    if (typeof a !== 'string' || !a) return;
    if (!freshest[a] || (+r.rec.at || 0) > (+freshest[a].at || 0)) freshest[a] = r.rec;
  });

  for (var j = 0; j < records.length; j++) {
    var path = records[j].path, rec = records[j].rec;
    var day = today(rec.tz);
    if (rec.sent === day) { counts.skipped++; continue; }
    var dueOn = (rec.acct && freshest[rec.acct] ? freshest[rec.acct].dueOn : rec.dueOn) || {};
    var n = +dueOn[day] || 0;
    // nothing due is no reminder, and no mark either: a projection that
    // arrives later the same day can still be acted on
    if (n <= 0) { counts.skipped++; continue; }
    var payload = JSON.stringify({
      title: n + (n === 1 ? ' card due' : ' cards due'),
      body: 'Tap to review',
      url: './index.html#/review',
      tag: 'due',
    });
    try {
      await webpush.sendNotification({ endpoint: rec.endpoint, keys: rec.keys }, payload, { TTL: TTL, urgency: 'normal' });
    } catch (e) {
      if (gone(e)) {
        try { await blob.del(path, blobOpts()); counts.dropped++; } catch (e2) { counts.failed++; }
      } else {
        counts.failed++;
      }
      continue;
    }
    counts.sent++;
    try {
      rec.sent = day;
      await blob.put(path, JSON.stringify(rec), blobOpts({
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      }));
    } catch (e) {
      // the nudge went out; a mark that failed to stick costs at worst a
      // second nudge tomorrow's run would have sent anyway
      counts.failed++;
    }
  }
  return send(res, 200, counts);
};

// for the tests: the day a record is measured against
module.exports.today = today;
module.exports.configured = configured;
