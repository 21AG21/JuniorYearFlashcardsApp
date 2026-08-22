/* Cards account worker — the sync half of an "account" for AP Decks.
 *
 *   GET /api/state -> { updatedAt, state }        + Bearer <account token>
 *   PUT /api/state <- { updatedAt, state }        + Bearer <account token>
 *
 * An account IS a token. Tokens are provisioned by hand (wrangler kv key put
 * tok:<sha256(token)> 1) — the worker never mints them, so a guessed token is
 * useless unless its hash was provisioned. State is one JSON blob per account
 * under state:<sha256(token)>; the app merges, the worker just stores.
 */

const ALLOW_ORIGINS = [
  'https://21ag21.github.io',
  'https://myfleshcards.vercel.app',
  'http://localhost:8791',
  'http://127.0.0.1:8791',
];

const MAX_BYTES = 2 * 1024 * 1024; // a full 2,277-card state is ~200 KB; 2 MB is generous

function cors(req) {
  const o = req.headers.get('origin') || '';
  return {
    'access-control-allow-origin': ALLOW_ORIGINS.includes(o) ? o : ALLOW_ORIGINS[0],
    'access-control-allow-methods': 'GET, PUT, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

const json = (obj, status, extra) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
  });

async function accountHash(req) {
  const m = /^Bearer\s+([A-Za-z0-9_-]{16,128})$/.exec(req.headers.get('authorization') || '');
  if (!m) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(m[1]));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const C = cors(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: C });
    if (url.pathname !== '/api/state') return json({ error: 'not found' }, 404, C);

    const hash = await accountHash(req);
    if (!hash) return json({ error: 'unauthorized' }, 401, C);
    // Only provisioned accounts: the hash must have been put there on purpose.
    if (!(await env.CARDS.get(`tok:${hash}`))) return json({ error: 'unauthorized' }, 401, C);

    if (req.method === 'GET') {
      const raw = await env.CARDS.get(`state:${hash}`);
      return new Response(raw ?? JSON.stringify({ updatedAt: 0, state: null }), {
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...C },
      });
    }

    if (req.method === 'PUT') {
      const body = await req.text();
      if (body.length > MAX_BYTES) return json({ error: 'too large' }, 413, C);
      let parsed;
      try { parsed = JSON.parse(body); } catch { return json({ error: 'bad json' }, 400, C); }
      if (typeof parsed?.updatedAt !== 'number' || typeof parsed?.state !== 'object' || parsed.state === null) {
        return json({ error: 'need { updatedAt, state }' }, 400, C);
      }
      await env.CARDS.put(`state:${hash}`, body);
      return json({ ok: true, updatedAt: parsed.updatedAt }, 200, C);
    }

    return json({ error: 'method' }, 405, C);
  },
};
