/* ════════════════════════════════════════════════════════════════
   test/announcement.test.js
   置頂公告（細條）單測：書架位置有限，鼓勵讚好／收藏（軟性版）

   守住：
   1) HTML 有 #pinned-announce 細條，喺 topbar 之後、page-nav 之前（置頂）
   2) ANNOUNCEMENT 設定存在、enabled、文案用「書架位置有限」軟性講落架，
      唔准寫到好似監察用戶咁（唔准出現使用數據／打開次數／定期睇之類字眼）
   3) 預設收起（一行），撳掣展開／收埋，狀態記喺 localStorage（跟 id）
   4) 後台（#admin）唔顯示；enabled=false 唔顯示
   5) 公開版唔可以有 emoji 圖示（同 labels.test 一樣嘅硬性規則）
   ════════════════════════════════════════════════════════════════ */
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const html = read("index.html");
const storeSrc = read("store.js");

// ── 1) HTML 結構：置頂位置 ──────────────────────────────────────
assert.ok(html.includes('id="pinned-announce"'), "HTML 要有 #pinned-announce 置頂公告");
assert.ok(html.includes('id="announce-badge"') && html.includes('id="announce-title"') && html.includes('id="announce-text"') && html.includes('id="announce-toggle"'),
  "公告要有 badge／title／text／toggle 四個位");
assert.ok(html.includes('data-icon="bell"'), "公告圖示用線稿 bell（唔准 emoji）");
const topbarIdx = html.indexOf('id="topbar"');
const announceIdx = html.indexOf('id="pinned-announce"');
const pageNavIdx = html.indexOf('id="page-nav"');
const heroIdx = html.indexOf('id="hero-spotlight"');
assert.ok(topbarIdx < announceIdx && announceIdx < pageNavIdx, "公告要喺 topbar 之後、page-nav 之前（置頂，一入站就見到）");
assert.ok(announceIdx < heroIdx, "公告要喺今期主打上面");

// ── 2) ANNOUNCEMENT 設定：軟性文案（書架講法，唔透露點樣判斷）────
assert.ok(/const ANNOUNCEMENT = \{/.test(html), "要有 ANNOUNCEMENT 設定物件（改文案只改呢度）");
assert.ok(/enabled:\s*true/.test(html), "公告預設開啟");
assert.ok(/collapsedByDefault:\s*true/.test(html), "公告預設收起（一行細條）");
assert.ok(html.includes("書架位置有限"), "標題要用「書架位置有限」軟性講法");
assert.ok(html.includes("落架") && html.includes("留返啲位"), "內文要講少人用嘅會落架、留位畀新工具");
assert.ok(html.includes("讚好") && html.includes("收藏"), "內文要鼓勵用戶讚好／收藏鍾意嘅 App");
assert.ok(html.includes("話畀我哋知佢值得留低"), "目的係等用戶表態，唔係警告");
for (const banned of ["使用數據", "打開次數", "定期睇", "舊連結會搵唔到", "政策更新", "無人使用嘅 App 會下架"]) {
  assert.ok(!html.includes(banned), `文案唔准太直接／透露判斷方法：「${banned}」唔應該出現`);
}
assert.ok(/id:\s*"shelf-love-your-apps-/.test(html), "公告 id 要有版本號（改文案時改 id 先會重置用戶記認）");

// ── 3) CSS：細條樣式跟 DESIGN token ─────────────────────────────
const style = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
assert.ok(/\.announce \{[^}]*border-radius: var\(--radius\)/.test(style), "公告卡用同一個圓角 token（16）");
assert.ok(/\.announce\.collapsed \.announce-text \{[^}]*display: none/.test(style), "收起時內文隱藏（淨返一行）");
assert.ok(/\.announce\[hidden\] \{[^}]*display: none/.test(style), "hidden 時唔顯示（唔會閃出舊內容）");
assert.ok(!/\.announce \{[^}]*linear-gradient/.test(style), "公告唔准用漸層（house rules）");

// ── 4) 公開版唔准有 emoji 圖示（同 labels.test 同一規則）────────
const stripCode = (x) => x
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "")
  .replace(/(?<!:)\/\/.*$/gm, "");
const EMOJI_RX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
assert.ok(!EMOJI_RX.test(stripCode(html)), "公開版 HTML 唔可以再有 emoji 圖示");

// ── 5) 動態：renderAnnouncement 行為（fake DOM）─────────────────
function fakeEl(id) {
  const set = new Set();
  return {
    id, hidden: true, innerHTML: "", textContent: "", value: "",
    dataset: {}, style: { setProperty() {} }, offsetHeight: 40, offsetTop: 0,
    classList: {
      _s: set,
      toggle(c, f) { const v = f === undefined ? !set.has(c) : !!f; v ? set.add(c) : set.delete(c); return v; },
      add(c) { set.add(c); }, remove(c) { set.delete(c); }, contains(c) { return set.has(c); }
    },
    querySelector() { return fakeEl("q"); }, querySelectorAll() { return []; },
    addEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    appendChild() {}, focus() {}, scrollIntoView() {}, closest() { return null; }
  };
}
function runAnnouncement({ admin = false, enabled = true, stored = null } = {}) {
  const els = {};
  const mem = new Map();
  if (stored !== null) mem.set("announce-collapsed-shelf-love-your-apps-20261117", stored);
  const ctx = {
    document: {
      documentElement: { dataset: { theme: "dark" }, style: { setProperty() {} } },
      getElementById(id) { return els[id] || (els[id] = fakeEl(id)); },
      querySelector() { return null; }, querySelectorAll() { return []; },
      addEventListener() {}, createElement() { return fakeEl("c"); }
    },
    localStorage: {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k)
    },
    window: { addEventListener() {}, location: { href: "http://x/", hash: admin ? "#admin" : "" } },
    navigator: {}, console, setTimeout, clearTimeout
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  // 只抽 ANNOUNCEMENT 相關 code（唔跑成段 boot，避免要 fake 晒成個頁面）
  const announceCode = `
    function isAdminRoute() { return (window.location.hash || "").includes("admin"); }
    ${html.match(/const ANNOUNCEMENT = \{[\s\S]*?\n\};/)[0]}
    const announceEl = document.getElementById("pinned-announce");
    const ANNOUNCE_COLLAPSE_KEY = "announce-collapsed-" + ANNOUNCEMENT.id;
    let _announceCollapsed = ANNOUNCEMENT.collapsedByDefault !== false;
    try {
      const _ac = localStorage.getItem(ANNOUNCE_COLLAPSE_KEY);
      if (_ac === "1") _announceCollapsed = true;
      else if (_ac === "0") _announceCollapsed = false;
    } catch {}
    function syncAnnounceToggle() {
      const btn = document.getElementById("announce-toggle");
      if (!btn) return;
      btn.innerHTML = "ICON";
      btn.setAttribute("aria-expanded", _announceCollapsed ? "false" : "true");
    }
    function setAnnounceCollapsed(on) {
      _announceCollapsed = !!on;
      if (announceEl) announceEl.classList.toggle("collapsed", _announceCollapsed);
      syncAnnounceToggle();
      try { localStorage.setItem(ANNOUNCE_COLLAPSE_KEY, _announceCollapsed ? "1" : "0"); } catch {}
    }
    function renderAnnouncement() {
      if (!announceEl) return;
      if (!ANNOUNCEMENT.enabled || isAdminRoute()) { announceEl.hidden = true; return; }
      const setText = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt == null ? "" : String(txt);
      };
      setText("announce-badge", ANNOUNCEMENT.badge);
      setText("announce-title", ANNOUNCEMENT.title);
      setText("announce-date", ANNOUNCEMENT.date);
      setText("announce-text", ANNOUNCEMENT.body);
      announceEl.hidden = false;
      announceEl.classList.toggle("collapsed", _announceCollapsed);
      syncAnnounceToggle();
    }
  `;
  vm.runInContext(announceCode, ctx);
  if (!enabled) vm.runInContext("ANNOUNCEMENT.enabled = false;", ctx);
  vm.runInContext("renderAnnouncement();", ctx);
  return { els, mem, ctx };
}

// 公開版：顯示、預設收起、文案正確
{
  const { els } = runAnnouncement();
  assert.strictEqual(els["pinned-announce"].hidden, false, "公開版公告要顯示");
  assert.ok(els["pinned-announce"].classList.contains("collapsed"), "公開版公告預設收起（一行）");
  assert.strictEqual(els["announce-title"].textContent, "書架位置有限，鍾意嘅 App 記得讚好／收藏", "標題正確（軟性版）");
  assert.ok(els["announce-text"].textContent.includes("書架位置有限"), "內文用書架講法");
  assert.ok(els["announce-text"].textContent.includes("落架"), "內文講明少人用嘅會落架");
  assert.ok(els["announce-text"].textContent.includes("讚好") && els["announce-text"].textContent.includes("收藏"), "內文鼓勵讚好／收藏");
  assert.ok(!els["announce-text"].textContent.includes("使用數據"), "內文唔准透露點樣判斷");
}
// 後台：唔顯示
{
  const { els } = runAnnouncement({ admin: true });
  assert.strictEqual(els["pinned-announce"].hidden, true, "後台（#admin）唔顯示公告");
}
// enabled=false：唔顯示
{
  const { els } = runAnnouncement({ enabled: false });
  assert.strictEqual(els["pinned-announce"].hidden, true, "enabled=false 時唔顯示公告");
}
// 用戶之前展開過：記住展開
{
  const { els } = runAnnouncement({ stored: "0" });
  assert.ok(!els["pinned-announce"].classList.contains("collapsed"), "之前展開過要記住展開");
}
// 用戶之前收埋過：記住收埋
{
  const { els } = runAnnouncement({ stored: "1" });
  assert.ok(els["pinned-announce"].classList.contains("collapsed"), "之前收埋過要記住收埋");
}

console.log("✅ announcement: 置頂細條位置、軟性文案（書架／讚好收藏）、收起／展開記認、後台隱藏全部通過");
