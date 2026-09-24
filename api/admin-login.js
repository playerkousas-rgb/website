// PIN checked only on the server. The underlying Supabase password stays secret.
const { timingSafeEqual } = require('node:crypto');
const attempts = new Map();
module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const send = (code, data) => res.status(code).send(JSON.stringify(data));
  if (req.method !== 'POST') return send(405, { error: '只接受 POST' });
  try {
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return send(403, { error: '來源不符' });
  } catch { return send(403, { error: '來源不符' }); }
  const { ADMIN_PIN, SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, ADMIN_AUTH_PASSWORD } = process.env;
  if (!ADMIN_PIN || !SUPABASE_URL || !SUPABASE_ANON_KEY || !ADMIN_EMAIL || !ADMIN_AUTH_PASSWORD)
    return send(503, { error: '管理員登入尚未設定，請按部署說明設定環境變數。' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0];
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.until < now) attempts.delete(key);
  const entry = attempts.get(ip) || { count: 0, until: now + 15 * 60 * 1000 };
  if (entry.count >= 5) return send(429, { error: '嘗試次數過多，請 15 分鐘後再試。' });
  entry.count++; attempts.set(ip, entry);
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return send(400, { error: '無效請求' }); }
  const pin = Buffer.from(String(body?.password || ''));
  const expected = Buffer.from(ADMIN_PIN);
  if (pin.length !== expected.length || !timingSafeEqual(pin, expected)) return send(401, { error: '密碼不正確' });
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_AUTH_PASSWORD }), signal: AbortSignal.timeout(8000)
    });
    const session = await response.json();
    if (!response.ok) return send(503, { error: '管理員帳戶設定有誤，請檢查伺服器設定。' });
    attempts.delete(ip);
    return send(200, { access_token: session.access_token, refresh_token: session.refresh_token });
  } catch { return send(503, { error: '登入服務暫時無法連線，請稍後再試。' }); }
};
