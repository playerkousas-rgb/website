const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const marketSrc = fs.readFileSync('market.js', 'utf8');
const storeSrc = fs.readFileSync('store.js', 'utf8');
const swSrc = fs.readFileSync('sw.js', 'utf8');
const elements = new Map();
function fakeElement(id) {
  const listeners = {};
  return {
    id, listeners, value: '', textContent: '', className: '', disabled: false, hidden: false,
    dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener(type, listener) { listeners[type] = listener; },
    setAttribute() {}, showModal() {}, close() {}
  };
}
let selectedFeedbackType = '建議';
const document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, fakeElement(id));
    return elements.get(id);
  },
  querySelectorAll() { return []; },
  querySelector(selector) {
    return selector === 'input[name="feedback-type"]:checked' ? { value: selectedFeedbackType } : null;
  }
};
const requests = [];
const ctx = {
  document,
  navigator: { onLine: true },
  location: { href: 'https://scoutappstore.example/#apps' },
  SCOUT_ADMIN_CONFIG: { execUrl: 'https://script.google.com/macros/s/test/exec' },
  fetch: async (url, options) => { requests.push({ url, options }); return { type: 'opaque' }; },
  console
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(marketSrc + '\n;this.__reportApi = { reportSetKind, buildIssueReportPayload, buildFeedbackReportPayload, validateReportForm };', ctx);
const api = ctx.__reportApi;

// The header opens an in-page form, not the library site.
const headerButton = html.match(/<button[^>]*class="market-submit head-submit feedback-btn"[^>]*>[\s\S]*?<\/button>/);
assert.ok(headerButton, 'header feedback action is a button');
assert.match(headerButton[0], /onclick="reportOpen\(\)"/);
assert.match(headerButton[0], /aria-controls="report-dialog"/);
assert.doesNotMatch(html, /href="https:\/\/scout-circulars\.vercel\.app\//, 'feedback action must not redirect to the library');
assert.match(html, /<dialog id="report-dialog"/);
assert.match(html, /data-report-kind="issue"/);
assert.match(html, /data-report-kind="feedback"/);
assert.match(html, /來源 APP：<b>SCOUT APP STORE<\/b>/);
assert.match(html, /name="title"/);
assert.match(html, /name="problem"/);
assert.match(html, /name="severity"/);
assert.match(html, /name="fbType"|name="feedback-type"/);
assert.match(html, /name="opinion"/);
assert.match(html, /name="troopId"/);
assert.match(html, /name="name"/);
assert.match(html, /name="contact"/);
assert.match(html, /value="建議"[\s\S]*value="讚"[\s\S]*value="批評"[\s\S]*value="其他"/);
assert.match(html, /資料會直接送到 Scout Admin（Google Sheet）/);
assert.match(marketSrc, /SCOUT_ADMIN_CONFIG\.execUrl/);
assert.match(marketSrc, /mode: 'no-cors'/, 'uses the Apps Script-compatible transport');
assert.match(marketSrc, /sourceApp: REPORT_SOURCE_APP/);
assert.match(storeSrc, /execUrl: "https:\/\/script\.google\.com\/macros\/s\//, 'uses the configured Scout Admin receiver');
assert.match(swSrc, /const CACHE = 'scout-tools-v32'/, 'the revised form must invalidate the previous PWA cache');

const issue = JSON.parse(JSON.stringify(api.buildIssueReportPayload({
  title: '搜尋結果沒有顯示', problem: '按搜尋後畫面空白', severity: '高',
  troopId: '0082', name: '阿明', contact: 'ming@example.com'
})));
assert.deepEqual(issue, {
  type: 'issue', sourceApp: 'SCOUT APP STORE', title: '搜尋結果沒有顯示',
  desc: '按搜尋後畫面空白', severity: '高', troopId: '0082',
  name: '阿明', contact: 'ming@example.com'
});
const feedback = JSON.parse(JSON.stringify(api.buildFeedbackReportPayload({
  fbType: '批評', opinion: '希望改善搜尋篩選', troopId: '0082', name: '阿明', contact: '9123 4567'
})));
assert.deepEqual(feedback, {
  type: 'feedback', sourceApp: 'SCOUT APP STORE', fbType: '批評',
  content: '希望改善搜尋篩選', troopId: '0082', name: '阿明', contact: '9123 4567'
});
assert.equal(api.validateReportForm('issue', { title: '', problem: '詳情' }), '請填寫問題標題。');
assert.equal(api.validateReportForm('issue', { title: '標題', problem: '  ' }), '請填寫問題詳情。');
assert.equal(api.validateReportForm('feedback', { opinion: '' }), '請填寫意見內容。');
assert.equal(api.validateReportForm('feedback', { opinion: '建議' }), '');

// Exercise the actual submit handlers and verify the official Scout Admin schema is sent.
for (const [id, value] of Object.entries({
  'report-issue-title': '搜尋結果沒有顯示', 'report-problem': '按搜尋後畫面空白',
  'report-severity': '高', 'report-issue-troop': '0082', 'report-issue-name': '阿明', 'report-issue-contact': 'ming@example.com',
  'report-opinion': '', 'report-feedback-troop': '', 'report-feedback-name': '', 'report-feedback-contact': ''
})) document.getElementById(id).value = value;
const form = document.getElementById('report-form');
(async () => {
  await form.listeners.submit({ preventDefault() {}, currentTarget: form });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, ctx.SCOUT_ADMIN_CONFIG.execUrl);
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.mode, 'no-cors');
  assert.deepEqual(JSON.parse(requests[0].options.body), issue);
  assert.equal(document.getElementById('report-status').textContent, '問題回報已提交，多謝！管理員會盡快跟進。');

  api.reportSetKind('feedback');
  selectedFeedbackType = '讚';
  document.getElementById('report-opinion').value = '多謝這個實用工具';
  document.getElementById('report-feedback-troop').value = '0082';
  document.getElementById('report-feedback-name').value = '阿明';
  document.getElementById('report-feedback-contact').value = '9123 4567';
  await form.listeners.submit({ preventDefault() {}, currentTarget: form });
  assert.equal(requests.length, 2);
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    type: 'feedback', sourceApp: 'SCOUT APP STORE', fbType: '讚', content: '多謝這個實用工具',
    troopId: '0082', name: '阿明', contact: '9123 4567'
  });
  assert.equal(document.getElementById('report-status').textContent, '意見已收到，多謝你！');
  console.log('✅ report: in-page form matches Scout Admin widget payloads and writes to its Apps Script endpoint');
})().catch(error => { console.error(error); process.exitCode = 1; });
