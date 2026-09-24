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
    const { data, error } = await sb.rpc('submit_work', { work });
    if (error) throw new Error(error.code === 'PGRST202' ? '投稿服務尚未啟用，請管理員先執行資料庫升級。' : error.message);
    form.reset();
    result.textContent = `已收到作品！批核後才會公開上架。投稿編號：${data}`;
  } catch (error) { result.textContent = error.message || '提交失敗，請再試。'; }
  finally { button.disabled = false; }
});
let reviewFilter = 'pending';
async function loadReviews() {
  const panel = document.getElementById('review-panel');
  if (!panel || !ADMIN.authed) return;
  panel.innerHTML = '<p>正在讀取投稿…</p>';
  try {
    const { data, error } = await getSB().from('submissions').select('*').eq('status', reviewFilter).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    if (!panel.isConnected) return;
    panel.innerHTML = `<section class="review-box"><h3>作品審核</h3><div class="admin-actions">${[['pending','待審核'],['approved','已上架'],['rejected','已拒絕']].map(([id,label]) => `<button class="mini-btn ${reviewFilter===id?'primary':''}" data-review-filter="${id}">${label}</button>`).join('')}</div><p class="admin-hint">最多顯示最近 100 筆；只有批准的作品才會出現在商店。</p>${data.length ? data.map(s => `<article class="review-item"><h4>${esc(s.name)}</h4><p>${esc(s.description)}</p><p class="admin-hint">${esc(s.author)} · ${esc(s.category)} · ${new Date(s.created_at).toLocaleDateString('zh-HK')}</p><p>${s.tags.map(t => `<span class="market-tag">${esc(t)}</span>`).join('')}</p><a href="${esc(/^https?:\/\//i.test(s.url) ? s.url : '#')}" target="_blank" rel="noopener noreferrer">查看作品 ↗</a>${reviewFilter==='pending'?`<div class="admin-actions"><button class="mini-btn primary" data-review="${s.id}" data-approve="true">批准上架</button><button class="mini-btn danger" data-review="${s.id}" data-approve="false">拒絕</button></div>`:''}</article>`).join(''):'<p class="review-empty">暫時沒有這個狀態的投稿。</p>'}</section>`;
    panel.querySelectorAll('[data-review-filter]').forEach(btn => btn.onclick = () => { reviewFilter = btn.dataset.reviewFilter; loadReviews(); });
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
