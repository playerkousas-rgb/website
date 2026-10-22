/* Community publishing: never silently falls back to browser-only storage.
   支援三種分享模式（降低上傳 Link 門檻）：
   - app:      🧰 提交作品（自製網頁 App／小工具／小遊戲）
   - link:     🌐 網站分享（推薦任何對童軍有用嘅網站，唔使係網站作者）
   - material: 📚 教材分享（貼 Google Drive／Canva／OneDrive／簡報／圖卡等雲端連結，唔使自己起網站） */
const SUBMIT_MODES = {
  app: {
    eyebrow: 'MADE BY YOU',
    title: '分享你的作品',
    intro: '填上作品連結及標籤。提交後會寫入商店資料庫，並同時登記到管理員嘅投稿表＋電郵通知管理員；批核後才會公開上架。',
    tip: '🧰 適合分享你開發或製作嘅童軍網頁小工具、電子進度紀錄、計分器或小遊戲。想分享一般網站或雲端教材？可切換上方「🌐 網站分享」或「📚 教材分享」。',
    examples: '',
    nameLabel: '作品名稱',
    namePlaceholder: '例如：露營裝備清單',
    urlLabel: '作品連結',
    urlPlaceholder: 'https://…',
    authorLabel: '作者名稱',
    authorPlaceholder: '你的名字或團隊名稱',
    authorRequired: true,
    defaultAuthor: '熱心作者',
    pageLabel: '作品類型',
    categoryLabel: '分類',
    descLabel: '作品簡介',
    descPlaceholder: '作品有甚麼用途？適合誰使用？',
    consentText: '我確認有權分享此作品，並同意上述作品資料在批核後公開。',
    submitLabel: '提交審核 →',
    successTitle: '已收到作品！批核後才會公開上架。',
    pages: [
      { id: 'apps', label: '小工具 Apps', categories: ['電子進度紀錄', '小工具', '小遊戲'] }
    ]
  },
  link: {
    eyebrow: 'WEBSITE SHARE',
    title: '🌐 網站分享',
    intro: '發現對童軍活動、集會、露營或訓練有用嘅網站？唔使自己寫 App，貼條連結就可以推薦畀大家！批核後會公開上架。',
    tip: '💡 門檻極低：唔使係網站擁有者！只要覺得個網站對童軍有用，貼條 Link 加句簡單介紹就分享得。',
    examples: '常見分享：🌐 童軍／總會網站 · ⛺ 營地／行山天氣資訊 · 🪢 繩結／步操／急救教學網 · 🎮 集會互動遊戲網',
    nameLabel: '網站名稱',
    namePlaceholder: '例如：香港天文台九天天氣預報／繩結動畫教學網',
    urlLabel: '網站連結',
    urlPlaceholder: 'https://…（直接貼上推薦網站嘅網址）',
    authorLabel: '分享者／推薦人（選填，可匿名）',
    authorPlaceholder: '例如：阿明 / 82旅（留空＝熱心童軍）',
    authorRequired: false,
    defaultAuthor: '熱心童軍',
    pageLabel: '分享專區',
    categoryLabel: '網站分類',
    descLabel: '推薦原因／網站簡介',
    descPlaceholder: '呢個網站有咩用？點解推薦畀其他領袖或童軍？（一兩句即可）',
    consentText: '我確認此網站連結安全並適合童軍使用，同意分享資料在批核後公開。',
    submitLabel: '提交網站分享 →',
    successTitle: '已收到網站分享！批核後才會公開上架。',
    pages: [
      { id: 'links', label: '有用連結', categories: ['童軍技能及知識', '露營及行山資訊', '集會及活動資源', '官方及總會網站', '其他實用網站'] }
    ]
  },
  material: {
    eyebrow: 'TEACHING MATERIALS',
    title: '📚 教材分享',
    intro: '唔使自己整網站！將你整好或常用嘅 Google Drive 教材、Canva 簡報、PDF 學習圖卡、工作紙或教學影片連結貼上嚟，同全港童軍領袖共享資源。',
    tip: '☁️ 支援各類雲端及網頁連結：Google Drive（請設為「知道連結的任何人可檢視」）、Canva、Google Slides / PPT、OneDrive、Dropbox、YouTube、Notion 等。',
    examples: '支援連結：📁 Google Drive · 🎨 Canva · 📊 Google Slides / PPT · ☁️ OneDrive / Dropbox · ▶️ YouTube · 📝 Notion',
    nameLabel: '教材名稱',
    namePlaceholder: '例如：幼童軍繩結學習圖卡／指北針教學 Canva 簡報',
    urlLabel: '教材連結（雲端／網頁連結）',
    urlPlaceholder: 'https://drive.google.com/… 或 https://www.canva.com/…',
    authorLabel: '分享者／製作人（選填，可匿名）',
    authorPlaceholder: '例如：陳領袖 / 82旅（留空＝熱心領袖）',
    authorRequired: false,
    defaultAuthor: '熱心領袖',
    pageLabel: '教材類型',
    categoryLabel: '教材分類',
    descLabel: '教材簡介／使用說明',
    descPlaceholder: '教材包含咩內容？適合邊個支部或專章集會使用？（一兩句即可）',
    consentText: '我確認有權分享此教材連結，並同意資料在批核後公開供童軍教學使用。',
    submitLabel: '提交教材分享 →',
    successTitle: '已收到教材分享！批核後才會公開上架。',
    pages: [
      { id: 'cards', label: '學習圖卡', categories: ['技能及專章圖卡', '步操及禮儀圖卡', '工作紙及考驗筆記', '其他圖文教材'] },
      { id: 'ppt', label: 'PPT 簡報', categories: ['集會教學簡報', '專章及訓練簡報', '領袖訓練及行政範本', '教學影片及多媒體'] }
    ]
  }
};

let submitKind = 'app';

function submissionPagesFor(kind) {
  const mode = SUBMIT_MODES[kind] || SUBMIT_MODES.app;
  const sitePages = (typeof SITES !== 'undefined' && SITES && Array.isArray(SITES.pages)) ? SITES.pages : [];
  if (kind === 'app') {
    const enabledApps = sitePages.filter(p =>
      p.enabled !== false && (p.categories || []).length &&
      p.id !== 'links' && p.id !== 'cards' && p.id !== 'ppt'
    );
    if (enabledApps.length) {
      return enabledApps.map(p => ({
        id: p.id,
        label: p.label,
        categories: p.categories.map(c => c.name).filter(Boolean)
      }));
    }
  }
  return mode.pages.map(dp => {
    const sp = sitePages.find(p => p.id === dp.id);
    const existing = (sp && Array.isArray(sp.categories)) ? sp.categories.map(c => c.name).filter(Boolean) : [];
    const merged = [...new Set([...existing, ...dp.categories])];
    return {
      id: dp.id,
      label: (sp && sp.label) || dp.label,
      categories: merged
    };
  });
}

function syncSubmitBranchChips() {
  const form = document.getElementById('submit-form');
  const tagsInput = (form && form.elements && form.elements.tags) || document.getElementById('submit-tags');
  const activeSet = new Set(
    String((tagsInput && tagsInput.value) || '')
      .split(/[,，、\n]/)
      .map(t => t.trim())
      .filter(Boolean)
  );
  document.querySelectorAll('.submit-branch-chip').forEach(btn => {
    const branch = btn.dataset && btn.dataset.branch;
    const on = !!(branch && activeSet.has(branch));
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function submissionToggleBranch(branch) {
  if (!branch) return;
  const form = document.getElementById('submit-form');
  const tagsInput = (form && form.elements && form.elements.tags) || document.getElementById('submit-tags');
  if (!tagsInput) return;
  const list = String(tagsInput.value || '')
    .split(/[,，、\n]/)
    .map(t => t.trim())
    .filter(Boolean);
  const idx = list.indexOf(branch);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(branch);
  tagsInput.value = list.join('、');
  syncSubmitBranchChips();
}

function submissionSetKind(kind) {
  submitKind = SUBMIT_MODES[kind] ? kind : 'app';
  const mode = SUBMIT_MODES[submitKind];
  document.querySelectorAll('.submit-tab').forEach(button => {
    const active = button.dataset.submitKind === submitKind;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setText('submit-eyebrow', mode.eyebrow);
  setText('submit-title', mode.title);
  setText('submit-intro', mode.intro);
  const tipEl = document.getElementById('submit-tip');
  if (tipEl) {
    tipEl.textContent = mode.tip || '';
    tipEl.hidden = !mode.tip;
  }
  const exEl = document.getElementById('submit-examples');
  if (exEl) {
    exEl.textContent = mode.examples || '';
    exEl.hidden = !mode.examples;
  }
  setText('submit-name-label', mode.nameLabel);
  const nameInput = document.getElementById('submit-name');
  if (nameInput) nameInput.placeholder = mode.namePlaceholder;

  setText('submit-url-label', mode.urlLabel);
  const urlInput = document.getElementById('submit-url');
  if (urlInput) urlInput.placeholder = mode.urlPlaceholder;

  setText('submit-author-label', mode.authorLabel);
  const authorInput = document.getElementById('submit-author');
  if (authorInput) {
    authorInput.placeholder = mode.authorPlaceholder;
    authorInput.required = !!mode.authorRequired;
  }

  setText('submit-page-label', mode.pageLabel);
  setText('submit-category-label', mode.categoryLabel);
  setText('submit-desc-label', mode.descLabel);
  const descInput = document.getElementById('submit-description');
  if (descInput) descInput.placeholder = mode.descPlaceholder;

  setText('submit-consent-text', mode.consentText);
  setText('submit-btn', mode.submitLabel);

  const form = document.getElementById('submit-form');
  const pageSelect = (form && form.elements && form.elements.page) || document.getElementById('submit-page');
  const catSelect = (form && form.elements && form.elements.category) || document.getElementById('submit-category');
  const pages = submissionPagesFor(submitKind);
  if (pageSelect && catSelect) {
    pageSelect.innerHTML = pages.map(p => `<option value="${esc(p.id)}">${esc(p.label)}</option>`).join('');
    pageSelect.value = pages[0] ? pages[0].id : '';
    const updateCategories = () => {
      const page = pages.find(p => p.id === pageSelect.value) || pages[0];
      const cats = (page && page.categories) || [];
      catSelect.innerHTML = cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
      catSelect.value = cats[0] || '';
    };
    pageSelect.onchange = updateCategories;
    updateCategories();
  }
}

function submissionOpen(kind) {
  const dialog = document.getElementById('submit-dialog');
  const form = document.getElementById('submit-form');
  if (form && typeof form.reset === 'function') form.reset();
  const res = document.getElementById('submit-result');
  if (res) res.textContent = '';
  submissionSetKind(kind || 'app');
  syncSubmitBranchChips();
  if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
}

document.querySelectorAll('.submit-tab').forEach(button => {
  button.addEventListener('click', () => submissionSetKind(button.dataset.submitKind));
});
document.querySelectorAll('.submit-branch-chip').forEach(button => {
  button.addEventListener('click', () => submissionToggleBranch(button.dataset.branch));
});
const submitTagsEl = document.getElementById('submit-tags');
if (submitTagsEl && typeof submitTagsEl.addEventListener === 'function') {
  submitTagsEl.addEventListener('input', syncSubmitBranchChips);
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
    const mode = SUBMIT_MODES[submitKind] || SUBMIT_MODES.app;
    const work = Object.fromEntries(new FormData(form));
    const url = new URL(work.url);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('請輸入有效的 HTTP / HTTPS 作品連結。');
    work.url = url.href;
    work.author = String(work.author || '').trim() || mode.defaultAuthor;
    if (!work.author) throw new Error('請填寫名稱。');
    work.tags = [...new Set(String(work.tags || '').split(/[,，、\n]/).map(t => t.trim()).filter(Boolean))];
    if (work.tags.length > 8 || work.tags.some(t => t.length > 20)) throw new Error('最多 8 個標籤，每個最多 20 字。');
    // 聯絡方式：選填；填錯格式即場提示，唔好等人交咗先知（DB 嗰份照樣會擋）
    work.contact = (work.contact || '').trim();
    work.phone = (work.phone || '').trim();
    if (work.contact && !scoutAdminEmail(work.contact)) throw new Error('聯絡電郵格式唔正確（例子：name@example.com）。留空就唔會送。');
    if (work.phone && !scoutAdminPhone(work.phone)) throw new Error('聯絡電話只可以用數字同 + - ( ) 空格。留空就唔會送。');
    // ① 寫入 Supabase（原路徑唔變：瀏覽器直接 call RPC，權限模型一樣）
    let { data, error } = await sb.rpc('submit_work', { work });
    // 若遠端 DB 尚未開放「有用連結／學習圖卡／PPT 簡報」分頁或分類，自動借用開放中分類入庫並標註目標分類
    if (error && /請選擇開放中的分類/.test(error.message || '')) {
      const openPage = ((typeof SITES !== 'undefined' && SITES && SITES.pages) || [])
        .find(p => p.enabled !== false && (p.categories || []).length);
      if (openPage) {
        const kindLabel = submitKind === 'link' ? '網站分享' : submitKind === 'material' ? '教材分享' : '作品提交';
        const pageLabel = (mode.pages.find(p => p.id === work.page) || {}).label || work.page;
        const prefix = `[${kindLabel}｜${pageLabel} › ${work.category}] `;
        const fallbackWork = {
          ...work,
          page: openPage.id,
          category: openPage.categories[0].name,
          description: (prefix + work.description).slice(0, 1000)
        };
        ({ data, error } = await sb.rpc('submit_work', { work: fallbackWork }));
      }
    }
    if (error) throw new Error(error.code === 'PGRST202' ? '投稿服務尚未啟用，請管理員先執行資料庫升級。' : error.message);
    form.reset();
    syncSubmitBranchChips();
    // ② 「多送一份」畀 Scout Admin → 登記 Google Sheet「作品投稿」＋ 電郵通知管理員（佢再轉寄負責人）
    //    呢步失敗唔會抹走已入庫嘅投稿，只會講明，等管理員喺後台手理。
    const notify = await notifyScoutAdmin({ ...work, id: data });
    result.textContent = `${mode.successTitle}投稿編號：${data}` + scoutAdminNotifyNote(notify);
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
function reviewKindBadge(s) {
  const desc = String((s && s.description) || '');
  if (desc.startsWith('[網站分享｜') || (s && s.page === 'links')) return '🌐 網站分享';
  if (desc.startsWith('[教材分享｜') || (s && (s.page === 'cards' || s.page === 'ppt'))) return '📚 教材分享';
  return '🧰 作品提交';
}
function reviewCardHTML(s) {
  const contactBits = [
    s.contact ? `<a href="mailto:${esc(s.contact)}">${esc(s.contact)}</a>` : '',
    s.phone ? `📞 ${esc(s.phone)}` : ''
  ].filter(Boolean);
  const forward = scoutAdminForwardMailto(s);
  const reply = scoutAdminReplyMailto(s);
  const badge = reviewKindBadge(s);
  return `<article class="review-item"><h4><span class="market-tag">${esc(badge)}</span> ${esc(s.name)}</h4><p>${esc(s.description)}</p><p class="admin-hint">${esc(s.author)} · ${esc(s.category)} · ${new Date(s.created_at).toLocaleDateString('zh-HK')}</p>${contactBits.length ? `<p class="admin-hint">📧 聯絡：${contactBits.join(' · ')}</p>` : ''}<p>${(s.tags || []).map(t => `<span class="market-tag">${esc(t)}</span>`).join('')}</p><a href="${esc(/^https?:\/\//i.test(s.url) ? s.url : '#')}" target="_blank" rel="noopener noreferrer">查看作品 ↗</a><div class="admin-actions">${reviewFilter==='pending'?`<button class="mini-btn primary" data-review="${s.id}" data-approve="true">批准上架</button><button class="mini-btn danger" data-review="${s.id}" data-approve="false">拒絕</button>`:''}${forward?`<a class="mini-btn" href="${esc(forward)}" title="將呢個投稿嘅資料用電郵轉交負責人">📧 轉寄負責人</a>`:''}${reviewFilter==='pending'?`<button class="mini-btn" data-resend="${s.id}" title="如果用家話收唔到／電郵通知Fail咗，撳呢度補送一份去 Scout Admin">📤 補送通知</button>`:''}${reply?`<a class="mini-btn" href="${esc(reply)}">✉️ 回覆作者</a>`:''}</div></article>`;
}

async function loadReviews() {
  const panel = document.getElementById('review-panel');
  if (!panel || !ADMIN.authed) return;
  panel.innerHTML = '<p>正在讀取投稿…</p>';
  try {
    const { data, error } = await getSB().from('submissions').select('*').eq('status', reviewFilter).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    if (!panel.isConnected) return;
    panel.innerHTML = `<section class="review-box"><h3>作品／網站／教材 審核</h3><div class="admin-actions">${[['pending','待審核'],['approved','已上架'],['rejected','已拒絕']].map(([id,label]) => `<button class="mini-btn ${reviewFilter===id?'primary':''}" data-review-filter="${id}">${label}</button>`).join('')}</div><p class="admin-hint">最多顯示最近 100 筆；只有批准的項目才會公開上架。每筆提交時已同時送一份去 Scout Admin（Google Sheet「作品投稿」＋電郵通知）${SCOUT_ADMIN_CONFIG.recordsUrl ? '，<a href="' + esc(SCOUT_ADMIN_CONFIG.recordsUrl) + '" target="_blank" rel="noopener noreferrer">開啟 Scout Admin</a>' : ''}。</p>${data.length ? data.map(reviewCardHTML).join(''):'<p class="review-empty">暫時沒有這個狀態的投稿。</p>'}</section>`;
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
      const row = data.find(x => x.id === btn.dataset.review);
      if (!confirm(approve ? '批准此項目並公開上架？' : '確定拒絕此項目？')) return;
      panel.querySelectorAll('[data-review]').forEach(b => b.disabled = true);
      try {
        let { error } = await getSB().rpc('review_work', { submission_id: btn.dataset.review, approve });
        if (error && approve && row && /原分類已關閉或刪除/.test(error.message || '')) {
          if (typeof ensureCategory === 'function') await ensureCategory(row.page, row.category, '');
          if (typeof adminSetPageEnabled === 'function') await adminSetPageEnabled(row.page, true);
          ({ error } = await getSB().rpc('review_work', { submission_id: btn.dataset.review, approve }));
        }
        if (error) throw error;
        await ADMIN.refresh();
      } catch (error) { alert(error.message); await loadReviews(); }
    });
  } catch { panel.innerHTML = '<div class="banner warn">未能載入投稿。請確認網絡及已執行 migrations/20260924-market.sql，再重新整理。</div>'; }
}
