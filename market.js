/* Community publishing: never silently falls back to browser-only storage. */
function submissionOpen() {
  const dialog = document.getElementById('submit-dialog');
  const form = document.getElementById('submit-form');
  form.reset();
  document.getElementById('submit-result').textContent = '';
  const pages = (SITES?.pages || []).filter(p => p.enabled !== false && p.categories.length);
  form.elements.page.innerHTML = pages.map(p => `<option value="${esc(p.id)}">${esc(p.label)}</option>`).join('');
  const updateCategories = () => {
    const page = pages.find(p => p.id === form.elements.page.value);
    form.elements.category.innerHTML = (page?.categories || []).map(c => `<option>${esc(c.name)}</option>`).join('');
  };
  form.elements.page.onchange = updateCategories;
  updateCategories();
  dialog.showModal();
}

/* 問題回報／意見回饋：留在本站，payload 欄位對齊 Scout Admin 官方 widget.js。 */
const REPORT_SOURCE_APP = 'SCOUT APP STORE';
let reportKind = 'issue';
function reportSetKind(kind) {
  reportKind = kind === 'feedback' ? 'feedback' : 'issue';
  document.querySelectorAll('.report-tab').forEach(button => {
    const active = button.dataset.reportKind === reportKind;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('[data-report-pane]').forEach(pane => {
    const active = pane.dataset.reportPane === reportKind;
    pane.classList.toggle('is-active', active);
    pane.hidden = !active;
  });
  const title = document.getElementById('report-title');
  if (title) title.textContent = reportKind === 'issue' ? '問題回報' : '意見回饋';
  const button = document.getElementById('report-submit');
  if (button) button.textContent = reportKind === 'issue' ? '提交問題回報' : '提交意見回饋';
  const status = document.getElementById('report-status');
  if (status) { status.textContent = ''; status.className = 'report-status'; }
}
function reportOpen(kind) {
  const dialog = document.getElementById('report-dialog');
  if (!dialog) return;
  reportSetKind(kind || reportKind);
  dialog.showModal();
}
function buildIssueReportPayload(fields) {
  return {
    type: 'issue',
    sourceApp: REPORT_SOURCE_APP,
    title: String(fields.title || '').trim(),
    desc: String(fields.problem || '').trim(),
    severity: String(fields.severity || '').trim() || '中',
    troopId: String(fields.troopId || '').trim(),
    name: String(fields.name || '').trim(),
    contact: String(fields.contact || '').trim()
  };
}
function buildFeedbackReportPayload(fields) {
  return {
    type: 'feedback',
    sourceApp: REPORT_SOURCE_APP,
    fbType: String(fields.fbType || '').trim() || '建議',
    content: String(fields.opinion || '').trim(),
    troopId: String(fields.troopId || '').trim(),
    name: String(fields.name || '').trim(),
    contact: String(fields.contact || '').trim()
  };
}
function validateReportForm(kind, fields) {
  if (kind === 'issue') {
    if (!String(fields.title || '').trim()) return '請填寫問題標題。';
    if (!String(fields.problem || '').trim()) return '請填寫問題詳情。';
  } else if (!String(fields.opinion || '').trim()) {
    return '請填寫意見內容。';
  }
  return '';
}

const reportForm = document.getElementById('report-form');
if (reportForm) {
  const reportDialog = document.getElementById('report-dialog');
  const reportStatus = document.getElementById('report-status');
  const reportSubmit = document.getElementById('report-submit');
  const setReportStatus = (message, state = '') => {
    reportStatus.textContent = message;
    reportStatus.className = 'report-status' + (state ? ' ' + state : '');
  };
  document.querySelectorAll('.report-tab').forEach(button => {
    button.addEventListener('click', () => reportSetKind(button.dataset.reportKind));
  });
  reportDialog.addEventListener('click', event => {
    if (event.target === reportDialog) reportDialog.close();
  });
  reportForm.addEventListener('submit', async event => {
    event.preventDefault();
    const fields = reportKind === 'issue' ? {
      title: document.getElementById('report-issue-title').value,
      problem: document.getElementById('report-problem').value,
      severity: document.getElementById('report-severity').value,
      troopId: document.getElementById('report-issue-troop').value,
      name: document.getElementById('report-issue-name').value,
      contact: document.getElementById('report-issue-contact').value
    } : {
      fbType: document.querySelector('input[name="feedback-type"]:checked')?.value || '建議',
      opinion: document.getElementById('report-opinion').value,
      troopId: document.getElementById('report-feedback-troop').value,
      name: document.getElementById('report-feedback-name').value,
      contact: document.getElementById('report-feedback-contact').value
    };
    const validationError = validateReportForm(reportKind, fields);
    if (validationError) { setReportStatus(validationError, 'is-error'); return; }
    if (navigator.onLine === false) { setReportStatus('目前離線，請連線後再提交。', 'is-error'); return; }
    const endpoint = (typeof SCOUT_ADMIN_CONFIG === 'object' && SCOUT_ADMIN_CONFIG.execUrl) || '';
    if (!endpoint) { setReportStatus('回報服務尚未設定，請稍後再試。', 'is-error'); return; }
    const payload = reportKind === 'issue'
      ? buildIssueReportPayload(fields)
      : buildFeedbackReportPayload(fields);
    reportSubmit.disabled = true;
    setReportStatus('提交中…');
    try {
      // 使用 Scout Admin 官方 widget 相同欄位與 Apps Script 接收端；no-cors 直接送出。
      await fetch(endpoint, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
      setReportStatus(reportKind === 'issue'
        ? '問題回報已提交，多謝！管理員會盡快跟進。'
        : '意見已收到，多謝你！', 'is-good');
      if (reportKind === 'issue') {
        document.getElementById('report-issue-title').value = '';
        document.getElementById('report-problem').value = '';
      } else document.getElementById('report-opinion').value = '';
    } catch {
      setReportStatus('提交失敗，請稍後再試。', 'is-error');
    } finally {
      reportSubmit.disabled = false;
    }
  });
}

document.getElementById('submit-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('[type=submit]');
  const result = document.getElementById('submit-result');
  button.disabled = true;
  result.textContent = '提交中…';
  try {
    if (!navigator.onLine) throw new Error('目前離線，請連線後再提交。');
    const sb = getSB();
    if (!sb) throw new Error('投稿服務尚未連線，請稍後再試。');
    const work = Object.fromEntries(new FormData(form));
    const url = new URL(work.url);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('請輸入有效的 HTTP / HTTPS 作品連結。');
    work.url = url.href;
    work.tags = [...new Set(work.tags.split(/[,，、\n]/).map(t => t.trim()).filter(Boolean))];
    if (work.tags.length > 8 || work.tags.some(t => t.length > 20)) throw new Error('最多 8 個標籤，每個最多 20 字。');
    // 聯絡方式：選填；填錯格式即場提示，唔好等人交咗先知（DB 嗰份照樣會擋）
    work.contact = (work.contact || '').trim();
    work.phone = (work.phone || '').trim();
    if (work.contact && !scoutAdminEmail(work.contact)) throw new Error('聯絡電郵格式唔正確（例子：name@example.com）。留空就唔會送。');
    if (work.phone && !scoutAdminPhone(work.phone)) throw new Error('聯絡電話只可以用數字同 + - ( ) 空格。留空就唔會送。');
    // ① 寫入 Supabase（原路徑唔變：瀏覽器直接 call RPC，權限模型一樣）
    const { data, error } = await sb.rpc('submit_work', { work });
    if (error) throw new Error(error.code === 'PGRST202' ? '投稿服務尚未啟用，請管理員先執行資料庫升級。' : error.message);
    form.reset();
    // ② 「多送一份」畀 Scout Admin → 登記 Google Sheet「作品投稿」＋ 電郵通知管理員（佢再轉寄負責人）
    //    呢步失敗唔會抹走已入庫嘅投稿，只會講明，等管理員喺後台手理。
    const notify = await notifyScoutAdmin({ ...work, id: data });
    result.textContent = `已收到作品！批核後才會公開上架。投稿編號：${data}` + scoutAdminNotifyNote(notify);
  } catch (error) { result.textContent = error.message || '提交失敗，請再試。'; }
  finally { button.disabled = false; }
});

/* ── ② 送通知去 Scout Admin（Google Apps Script：Sheet 登記 ＋ 電郵畀 ADMIN）──────
   行法：先打我哋自己嘅 /api/notify-admin（伺服器代送，先至讀到 Apps Script 嘅
   真結果）；如果呢個站冇 serverless（純靜態主機／未部署），先退回瀏覽器
   no-cors 直送 — 送得出去但讀唔到回應，所以只能講「未確認」，唔好扮成功。 */
async function notifyScoutAdmin(record) {
  const payload = scoutAdminSubmissionPayload(record);
  try {
    const res = await fetch('/api/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      ...(typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? { signal: AbortSignal.timeout(15000) } : {})
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data && data.sent) return { sent: true, verified: true, deduped: !!data.deduped, warnings: data.warnings || [] };
    // 404／405 = 呢個部署冇呢個 endpoint（例如純靜態主機）→ 退回前端直送
    if (res.status === 404 || res.status === 405) return notifyScoutAdminDirect(payload);
    return { sent: false, verified: false, error: (data && data.error) || `通知失敗（HTTP ${res.status}）`, warnings: (data && data.warnings) || [] };
  } catch {
    return notifyScoutAdminDirect(payload);
  }
}
async function notifyScoutAdminDirect(payload) {
  const url = (typeof SCOUT_ADMIN_CONFIG === 'object' && SCOUT_ADMIN_CONFIG.execUrl) || '';
  if (!url) return { sent: false, verified: false, error: '通知未設定' };
  try {
    // no-cors：Apps Script 冇回 CORS 標頭，讀唔到回應；body 用純字串先唔會触发 preflight
    await fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
    return { sent: true, verified: false };
  } catch {
    return { sent: false, verified: false, error: '通知送唔出' };
  }
}
// 結果文案：老實講邊度成功邊度未成功（投稿本身永遠以 Supabase 為準）
function scoutAdminNotifyNote(notify) {
  if (notify && notify.deduped) return '\n📮 呢單 5 分鐘內已送過 Scout Admin，唔會重送（管理員已經收到）。';
  if (notify && notify.verified && notify.sent) return '\n✅ 已登記喺 Scout Admin（Google Sheet＋電郵通知管理員，登記後會轉寄負責人）。';
  if (notify && notify.sent) return '\n📮 已送交 Scout Admin 登記（呢個環境讀唔到送達回執，管理員會核對）。';
  const reason = notify && notify.error ? `（${notify.error}）` : '';
  return `\n⚠️ Scout Admin 電郵通知未送達${reason}：你嘅投稿已喺資料庫，管理員仍可喺後台審核，唔使人手重交。`;
}

let reviewFilter = 'pending';
// 審核卡：除咗批准／拒絕，仲有「📧 轉寄」（預填好嘅 email，畀 ADMIN 登記後轉交負責人）
// 同「✉️ 回覆作者」（只有用家留咗聯絡電郵先見到）。
function reviewCardHTML(s) {
  const contactBits = [
    s.contact ? `<a href="mailto:${esc(s.contact)}">${esc(s.contact)}</a>` : '',
    s.phone ? `📞 ${esc(s.phone)}` : ''
  ].filter(Boolean);
  const forward = scoutAdminForwardMailto(s);
  const reply = scoutAdminReplyMailto(s);
  return `<article class="review-item"><h4>${esc(s.name)}</h4><p>${esc(s.description)}</p><p class="admin-hint">${esc(s.author)} · ${esc(s.category)} · ${new Date(s.created_at).toLocaleDateString('zh-HK')}</p>${contactBits.length ? `<p class="admin-hint">📧 聯絡：${contactBits.join(' · ')}</p>` : ''}<p>${s.tags.map(t => `<span class="market-tag">${esc(t)}</span>`).join('')}</p><a href="${esc(/^https?:\/\//i.test(s.url) ? s.url : '#')}" target="_blank" rel="noopener noreferrer">查看作品 ↗</a><div class="admin-actions">${reviewFilter==='pending'?`<button class="mini-btn primary" data-review="${s.id}" data-approve="true">批准上架</button><button class="mini-btn danger" data-review="${s.id}" data-approve="false">拒絕</button>`:''}${forward?`<a class="mini-btn" href="${esc(forward)}" title="將呢個投稿嘅資料用電郵轉交負責人">📧 轉寄負責人</a>`:''}${reviewFilter==='pending'?`<button class="mini-btn" data-resend="${s.id}" title="如果用家話收唔到／電郵通知Fail咗，撳呢度補送一份去 Scout Admin">📤 補送通知</button>`:''}${reply?`<a class="mini-btn" href="${esc(reply)}">✉️ 回覆作者</a>`:''}</div></article>`;
}

async function loadReviews() {
  const panel = document.getElementById('review-panel');
  if (!panel || !ADMIN.authed) return;
  panel.innerHTML = '<p>正在讀取投稿…</p>';
  try {
    const { data, error } = await getSB().from('submissions').select('*').eq('status', reviewFilter).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    if (!panel.isConnected) return;
    panel.innerHTML = `<section class="review-box"><h3>作品審核</h3><div class="admin-actions">${[['pending','待審核'],['approved','已上架'],['rejected','已拒絕']].map(([id,label]) => `<button class="mini-btn ${reviewFilter===id?'primary':''}" data-review-filter="${id}">${label}</button>`).join('')}</div><p class="admin-hint">最多顯示最近 100 筆；只有批准的作品才會出現在商店。每筆投稿提交時已同時送一份去 Scout Admin（Google Sheet「作品投稿」＋電郵通知）${SCOUT_ADMIN_CONFIG.recordsUrl ? '，<a href="' + esc(SCOUT_ADMIN_CONFIG.recordsUrl) + '" target="_blank" rel="noopener noreferrer">開啟 Scout Admin</a>' : ''}。</p>${data.length ? data.map(reviewCardHTML).join(''):'<p class="review-empty">暫時沒有這個狀態的投稿。</p>'}</section>`;
    panel.querySelectorAll('[data-review-filter]').forEach(btn => btn.onclick = () => { reviewFilter = btn.dataset.reviewFilter; loadReviews(); });
    panel.querySelectorAll('[data-resend]').forEach(btn => btn.onclick = async (ev) => {
      const row = data.find(x => x.id === btn.dataset.resend);
      if (!row) return;
      btn.disabled = true;
      const tip = document.getElementById('resend-note') || Object.assign(document.createElement('p'), { className: 'admin-hint', id: 'resend-note' });
      tip.textContent = '補送中…';
      if (!tip.isConnected) panel.querySelector('.review-box').appendChild(tip);
      const note = await notifyScoutAdmin(row);
      tip.textContent = scoutAdminNotifyNote(note).replace(/^\n+/, '');
      btn.disabled = false;
    });
    panel.querySelectorAll('[data-review]').forEach(btn => btn.onclick = async () => {
      const approve = btn.dataset.approve === 'true';
      if (!confirm(approve ? '批准此作品並公開上架？' : '確定拒絕此作品？')) return;
      panel.querySelectorAll('[data-review]').forEach(b => b.disabled = true);
      try {
        const { error } = await getSB().rpc('review_work', { submission_id: btn.dataset.review, approve });
        if (error) throw error;
        await ADMIN.refresh();
      } catch (error) { alert(error.message); await loadReviews(); }
    });
  } catch { panel.innerHTML = '<div class="banner warn">未能載入投稿。請確認網絡及已執行 migrations/20260924-market.sql，再重新整理。</div>'; }
}
