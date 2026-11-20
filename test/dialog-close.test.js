/* 回歸測試：投稿／回報彈窗嘅 ✕ 一定要喺手機撳得到。
   2026-11-20 用戶回報：「提交作品那些的 X 按鈕放太高了，手機開進後根本點不到關掉，
   只能把整個 APP 關掉重開」。
   成因：<dialog> 內容高過視窗時自己捲動，而 ✕ 用 position:absolute 釘喺 dialog
   右上角 —— 一捲走就冇咗，手機點都撳唔到。
   修法：✕ 收入 .dialog-head（position:sticky;top:0），做 44×44 圓掣；撳背景都可閂。
   呢個檔案鎖住呢三件事，防止日後「美化」時又改返 absolute。 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

const html = read("index.html");
const css = read("market.css");
const market = read("market.js");

/* ── 1) 兩個彈窗嘅 ✕ 都要喺 sticky 標題列入面 ───────────────── */
for (const id of ["submit-dialog", "report-dialog"]) {
  const re = new RegExp(`<div class="dialog-head">\\s*<button type="button" class="dialog-close" onclick="document\\.getElementById\\('${id}'\\)\\.close\\(\\)"`);
  assert.match(html, re, `${id} 嘅 ✕ 要包喺 .dialog-head 入面（sticky，捲幾遠都撳到）`);
}
assert.strictEqual((html.match(/class="dialog-head"/g) || []).length, 2, "兩個彈窗各一個 .dialog-head");

/* ── 2) CSS：sticky 標題列＋≥44px 觸控目標，唔准 absolute ──────── */
const rule = sel => {
  const m = css.match(new RegExp(`(?:^|[},])${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\{([^}]*)\\}`));
  return m ? m[1] : "";
};
const head = rule(".dialog-head");
assert.ok(/position:sticky/.test(head), ".dialog-head 要 position:sticky");
assert.ok(/top:0/.test(head), ".dialog-head 要釘喺頂 top:0");
const close = rule(".dialog-close");
assert.ok(!/position:absolute/.test(close), "✕ 唔可以再用 position:absolute（會捲出畫面外撳唔到）");
assert.ok(/width:44px/.test(close) && /height:44px/.test(close), "✕ 觸控目標最少 44×44px");
assert.ok(/flex:0 0 auto/.test(close), "✕ 唔可以被 flex 壓細");

/* ── 3) 撳背景／空白位都可以閂（多一條後路） ─────────────────── */
assert.match(market, /submitDialogEl\.addEventListener\('click', event => \{\s*if \(event\.target === submitDialogEl\) submitDialogEl\.close\(\);/, "投稿彈窗撳背景要閂得返");
assert.match(market, /if \(event\.target === reportDialog\) reportDialog\.close\(\);/, "回報彈窗撳背景要閂得返");

console.log("✓ 投稿／回報彈窗：✕ 喺 sticky 標題列、44px 觸控目標、撳背景可閂（手機一定閂得到）");
