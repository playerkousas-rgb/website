const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const handler = require('../api/admin-login');
const originalFetch = global.fetch;
async function request(password, extra = {}) {
  const result = { headers: {}, status(code) { this.code = code; return this; }, setHeader(k,v) { this.headers[k] = v; return this; }, send(body) { this.body = JSON.parse(body); } };
  await handler({ method: 'POST', headers: { host: 'preview.example', origin: 'https://preview.example', 'x-forwarded-for': 'test' }, body: { password }, ...extra }, result);
  return result;
}
(async () => {
  for (const file of ['app.js','admin.js','store.js','market.js','sw.js']) new vm.Script(fs.readFileSync(file,'utf8'), { filename: file });
  const html = fs.readFileSync('index.html','utf8');
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  delete process.env.ADMIN_PIN;
  assert.equal((await request('anything')).code,503, 'unconfigured must fail closed');
  Object.assign(process.env, { ADMIN_PIN: '0728', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'test', ADMIN_EMAIL: 'admin@example.com', ADMIN_AUTH_PASSWORD: 'server-only' });
  let calls = 0;
  global.fetch = async (url, options) => {
    calls++;
    assert.equal(JSON.parse(options.body).password,'server-only');
    return { ok: true, json: async () => ({ access_token:'access', refresh_token:'refresh', user: { password:'never-return' } }) };
  };
  assert.equal((await request('0728', {method:'GET'})).code,405);
  assert.equal((await request('0728', {headers:{host:'preview.example',origin:'https://evil.example'}})).code,403);
  assert.equal((await request('wrong')).code,401);
  assert.equal(calls,0);
  const success = await request('0728');
  assert.equal(success.code,200);
  assert.deepEqual(success.body,{access_token:'access',refresh_token:'refresh'});
  assert.equal(success.headers['Cache-Control'],'no-store');
  for(let i=0;i<5;i++) assert.equal((await request('wrong')).code,401);
  assert.equal((await request('0728')).code,429);
  const sql = fs.readFileSync('migrations/20260924-market.sql','utf8');
  assert.match(sql,/for update;/);
  assert.match(sql,/if not public.is_store_admin\(\)/);
  assert.match(sql,/revoke all on function public.review_work/);
  console.log('✅ market: syntax, fail-closed login, origin, PIN, throttling, token minimization and SQL guard checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; });
