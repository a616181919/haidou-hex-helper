// 海克斯大乱斗小助手 — 全免费 · 无广告 · 无会员
// 视觉与布局对齐原小程序(原版 CSS 类名复刻)
const $app = document.getElementById("app");
const DEPLOY_VER = "1793178161997";

const state = {
  view: "heroes", heroes: null, augments: null, items: null, rates: null, enums: null,
  currentHero: null, search: "", rankFilter: "all",
  relations: null, guides: null, builds: null, changelogs: null, generalNotes: null, listScroll: 0,
};
const RARITY_CN = { prismatic: "棱彩", gold: "黄金", silver: "白银" };
const LIVE_RATES = "https://lolhaidou.cn/data/hero_augment_rates.json";
const FALLBACK_ICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect fill='%2316213a' width='40' height='40'/></svg>";

async function loadJSON(p) {
  const r = await fetch(p + (p.includes("?") ? "&" : "?") + "v=" + DEPLOY_VER, { cache: "no-cache" });
  return r.json();
}

async function init() {
  $app.innerHTML = '<div class="loading">召唤师数据载入中…</div>';
  const [heroes, augments, items, rates, enums, relations, guides, builds, changelogs, generalNotes] = await Promise.all([
    loadJSON("data/heroes.json"), loadJSON("data/augments.json"), loadJSON("data/items.json"),
    loadJSON("data/augment-rates-snapshot.json").catch(() => null), loadJSON("data/enums.json").catch(() => ({})),
    loadJSON("data/hero-relations.json").catch(() => ({})), loadJSON("data/strategy-guides.json").catch(() => null),
    loadJSON("data/hero-builds.json").catch(() => ({})), loadJSON("data/lol-changelogs.json").catch(() => ({})),
    loadJSON("data/general-notes.json").catch(() => ({})),
  ]);
  Object.assign(state, { heroes, augments, items, rates, enums, relations, guides, builds, changelogs, generalNotes });
  if (rates) fetch(LIVE_RATES).then(r => r.json()).then(j => { if (j && j.heroCount) { state.rates = j; if (state.view === "heroes") renderHeroes(); } }).catch(() => {});
  const urlHero = new URLSearchParams(location.search).get("hero");
  const urlView = new URLSearchParams(location.search).get("view");
  if (urlHero && heroes[urlHero]) openHero(urlHero);
  else if (urlView === "feed") renderFeed();
  else if (urlView === "augments") renderAugments();
  else renderHeroes();
}

function header() {
  return `<header class="app-header">
    <div><div class="app-title">⚔️ 海克斯大乱斗小助手</div><div class="app-subtitle">全免费 · 无广告 · 数据每周同步</div></div>
    <nav class="tab-nav">
      <button class="tab-item ${state.view === "heroes" || state.view === "hero" ? "active" : ""}" data-nav="heroes">英雄推荐</button>
      <button class="tab-item ${state.view === "augments" ? "active" : ""}" data-nav="augments">海克斯图鉴</button>
      <button class="tab-item ${state.view === "feed" ? "active" : ""}" data-nav="feed">攻略·公告</button>
    </nav>
  </header>
  <div class="bg-glow glow-top"></div><div class="bg-glow glow-bottom"></div>`;
}
function bindNav() {
  $app.querySelectorAll("[data-nav]").forEach(b => b.onclick = () => {
    state.view = b.dataset.nav; state.currentHero = null; state.search = "";
    state.view === "augments" ? renderAugments() : state.view === "feed" ? renderFeed() : renderHeroes();
  });
}
function changePct(v) {
  if (v === undefined || v === null) return "";
  return `<span class="wr ${v > 0 ? "up" : v < 0 ? "down" : ""}">${v > 0 ? "▲" : v < 0 ? "▼" : ""}${Math.abs(v).toFixed(2)}%</span>`;
}

/* 原版风格海克斯卡(data-v-2fbe13c4 结构复刻) */
function augCard(a, opts = {}) {
  const rarity = a.rarity || "gold";
  const info = state.augments[a.name] || {};
  const desc = a.description || info.description || "";
  const tags = [];
  if (a.level) tags.push(`<span class="aug-tag lvl-tag lvl-${a.level.toLowerCase()}">${a.level} 级</span>`);
  if (a.hot) tags.push('<span class="aug-tag" style="background:rgba(251,146,60,.15);border:1px solid rgba(251,146,60,.3);color:#fb923c">🔥热门</span>');
  if (a.core) tags.push('<span class="aug-tag tag-core">核心</span>');
  if (a.isUserCreate) tags.push('<span class="aug-tag tag-special">玩家投稿</span>');
  if (opts.trap) tags.push('<span class="aug-tag tag-trap">陷阱</span>');
  if (opts.special) tags.push('<span class="aug-tag tag-special">特殊联动</span>');
  return `<div class="augment-card card-${rarity}">
    <div class="aug-main-content">
      <div class="aug-icon-wrapper border-${rarity}">
        <img class="aug-icon" src="${info.icon || a.icon || FALLBACK_ICON}" loading="lazy" onerror="this.src='${FALLBACK_ICON}'">
      </div>
      <div class="aug-info" style="flex:1;min-width:0">
        <div class="aug-name-row">
          <span class="aug-name">${a.name}</span>
          <span class="aug-tags">${tags.join("")}<span class="aug-tag" style="background:rgba(148,163,184,.12);color:#94a3b8">${RARITY_CN[rarity] || rarity}</span></span>
        </div>
        ${desc ? `<div style="font-size:12px;color:#8a93ad;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${desc}</div>` : ""}
      </div>
      ${a.winRate != null ? `<div class="pct"><b>${a.winRate.toFixed(1)}%</b><span>选取 ${a.pickRate != null ? a.pickRate.toFixed(1) + "%" : "—"}${a.score ? " · 评" + a.score : ""}</span>${a.winRateChange ? changePct(a.winRateChange) : ""}</div>` : ""}
    </div>
    ${a.reason ? `<div class="tips-box" style="margin-left:46px">${a.reason}</div>` : ""}
    ${a.tips ? `<div class="tips-box" style="margin-left:46px">💡 ${a.tips}</div>` : ""}
  </div>`;
}

/* ---------- 英雄列表 ---------- */
function renderHeroes() {
  const rates = state.rates?.data || {};
  const rows = Object.entries(state.heroes)
    .map(([name, h]) => ({ name, h, chg: h.winRateChange }))
    .filter(x => !state.search || x.name.includes(state.search) || (x.h.alias || []).some(a => a.toLowerCase().includes(state.search.toLowerCase())))
    .sort((a, b) => (b.h.winRate ?? 0) - (a.h.winRate ?? 0));
  $app.innerHTML = header() + `
    <div class="search-section"><div class="search-box-wrapper">
      <input class="search-input" placeholder="搜索英雄 / 别名（亚索、快乐风男、Yasuo…）" value="${state.search}">
      <span class="search-icon">🔍</span>
    </div></div>
    <div class="hero-grid">
      ${rows.map(x => `
        <div class="hero-card" data-hero="${x.name}">
          <img src="${x.h.avatar}" loading="lazy" onerror="this.src='${FALLBACK_ICON}'">
          <div class="nm">${x.name}</div>
          <div class="wr">胜率 ${x.h.winRate != null ? x.h.winRate.toFixed(1) + "%" : "—"} ${changePct(x.chg)}</div>
        </div>`).join("")}
    </div>
    <div class="meta">共 ${rows.length} 位英雄 · 胜率数据 ${state.rates?.update || "本地快照"}</div>`;
  const inp = $app.querySelector(".search-input");
  inp.oninput = e => { state.search = e.target.value; renderHeroes(); const n = $app.querySelector(".search-input"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  // 恢复列表滚动位置
  if (state.listScroll) { setTimeout(() => window.scrollTo({ top: state.listScroll }), 50); }
  $app.querySelectorAll("[data-hero]").forEach(c => c.onclick = () => { state.listScroll = window.scrollY; openHero(c.dataset.hero); });
  bindNav();
}

/* ---------- 英雄详情 ---------- */
function openHero(name, scroll = true) {
  const h = state.heroes[name];
  if (!h) return;
  state.currentHero = name; state.view = "hero";
  const build = (state.builds || {})[name] || {};
  const merged = (build.recommendations || []).map(x => ({ ...x, ...(state.augments[x.name] || {}) }));
  const recs = merged;
  const specials = (build.specialAugments || []).map(x => ({ ...x, ...(state.augments[x.name] || {}) }));
  const traps = (build.trapAugments || []).map(x => ({ ...x, ...(state.augments[x.name] || {}) }));
  const items = Object.entries(state.items).slice(0, 10).map(([k, v]) => ({ name: v.name || k, icon: v.icon, total: v.total }));
  // 装备指南
  const ig = build.itemGuide || [];
  $app.innerHTML = header() + `

    <div class="hero-switcher">
      <div class="hs-scroll">
        ${Object.entries(state.heroes).map(([n, hh]) => `
          <div class="hs-item ${n === name ? "current" : ""}" data-goto="${n}" title="${n}">
            <img src="${hh.avatar}" loading="lazy" onerror="this.src='${FALLBACK_ICON}'">
            <span>${n.length > 5 ? n.slice(0, 5) : n}</span>
          </div>`).join("")}
      </div>
    </div>
    <button class="back-btn" id="backBtn">← 返回英雄列表</button>
    <div class="hero-header">
      <img class="hero-avatar" src="${h.avatar}" onerror="this.src='${FALLBACK_ICON}'">
      <div style="flex:1;min-width:0">
        <div class="hero-name">${name}</div>
        <div class="hero-alias">${(h.alias || []).join(" / ")}</div>
        <div class="tags" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">
          ${(h.position || []).map(t => `<span class="aug-tag" style="background:rgba(56,189,248,.12);color:#38bdf8;height:auto;padding:2px 8px">${t}</span>`).join("")}
        </div>
      </div>
      <div class="wr-big">
        <div class="num">${h.winRate != null ? h.winRate.toFixed(1) + "%" : "—"}</div>
        <div class="lbl">大乱斗胜率 ${changePct(h.winRateChange)}</div>
        <div class="build-stats"><span class="aug-tag lvl-tag lvl-s">S ${build.sCount || 0}</span><span class="aug-tag lvl-tag lvl-a">A ${build.aCount || 0}</span><span class="aug-tag" style="background:rgba(148,163,184,.12);color:#94a3b8">共 ${build.total || 0}</span></div>
      </div>
    </div>
    <section>
      <div class="section-header">🎯 推荐海克斯 <small>原版算法评分 · S/A 级优先</small></div>
      ${recs.map((a, i) => augCard(a)).join("")}
      ${!recs.length ? '<div class="loading">暂无数据</div>' : ""}
    </section>
    ${specials.length ? `<section>
      <div class="section-header">💎 特殊海克斯联动 <small>拿到强度爆炸</small></div>
      ${specials.map(x => augCard({ ...x, special: true })).join("")}
    </section>` : ""}
    ${traps.length ? `<section>
      <div class="section-header">⚠️ 陷阱海克斯 <small>避坑</small></div>
      ${traps.map(x => augCard({ ...x, trap: true })).join("")}
    </section>` : ""}
    ${ig.length ? `<section>
      <div class="section-header">🛡️ 搭配装备指南 <small>${ig.filter(x => !x.trap).length} 推荐 / ${ig.filter(x => x.trap).length} 避坑</small></div>
      <div class="item-guide-grid">
        ${ig.map(it => `
          <div class="item-guide-card ${it.trap ? "trap" : ""}">
            <div style="min-width:0">
              <div class="ig-name">${it.trap ? "⛔" : "✅"} ${it.name}</div>
              <div class="ig-reason">${it.reason || ""}${it.from ? " · " + it.from : ""}</div>
            </div>
          </div>`).join("")}
      </div>
    </section>` : ""}
    <section>
      <div class="section-header">⚔️ 热门装备</div>
      <div class="item-guide-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
        ${items.map(x => `
          <div class="item-guide-card">
            <img src="${x.icon || FALLBACK_ICON}" style="width:36px;height:36px;border-radius:6px" loading="lazy" onerror="this.src='${FALLBACK_ICON}'">
            <div><div class="ig-name">${x.name}</div><div class="ig-reason">${x.total ? "💰 " + x.total : ""}</div></div>
          </div>`).join("")}
      </div>
    </section>
    ${(h.changes || []).length ? `<section>
      <div class="section-header">📋 版本改动</div>
      ${h.changes.map(c => `<div class="chg-box"><span class="aug-tag" style="background:rgba(56,189,248,.12);color:#38bdf8">${c.version}</span> <span style="font-size:12px;color:#8a93ad">${c.changesHtml || ""}</span></div>`).join("")}
    </section>` : ""}
    <div class="meta">数据来源: 海斗公开数据 · ${state.rates?.update || "本地快照"}</div>
    <button class="to-top" id="toTop" title="回到顶部">↑</button>`;
  document.getElementById("backBtn").onclick = () => { state.view = "heroes"; renderHeroes(); };
  $app.querySelectorAll("[data-goto]").forEach(el2 => el2.onclick = () => openHero(el2.dataset.goto));
  bindNav();
  const tt = document.getElementById("toTop");
  if (tt) tt.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  if (scroll) window.scrollTo({ top: 0 });
}

/* ---------- 海克斯图鉴 ---------- */
function renderAugments() {
  const all = Object.entries(state.augments).map(([name, a]) => ({ name, ...a }));
  const filtered = all
    .filter(a => state.rankFilter === "all" || a.rarity === state.rankFilter)
    .filter(a => !state.search || a.name.includes(state.search) || (a.description || "").includes(state.search))
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0));
  $app.innerHTML = header() + `
    <div class="search-section"><div class="search-box-wrapper">
      <input class="search-input" placeholder="搜索海克斯名称 / 效果描述" value="${state.search}">
      <span class="search-icon">🔍</span>
    </div></div>
    <div class="tab-nav" style="margin-bottom:14px;display:inline-flex">
      ${[["all", "全部"], ["prismatic", "棱彩"], ["gold", "黄金"], ["silver", "白银"]].map(([v, l]) =>
        `<button class="tab-item ${state.rankFilter === v ? "active" : ""}" data-rank="${v}">${l}</button>`).join("")}
    </div>
    ${filtered.map(a => augCard(a)).join("")}
    <div class="meta">共 ${filtered.length} 个海克斯</div>`;
  const inp = $app.querySelector(".search-input");
  inp.oninput = e => { state.search = e.target.value; renderAugments(); const n = $app.querySelector(".search-input"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  $app.querySelectorAll("[data-rank]").forEach(b => b.onclick = () => { state.rankFilter = b.dataset.rank; renderAugments(); });
  bindNav();
}

/* ---------- 攻略·公告 ---------- */
function renderFeed() {
  const guides = state.guides?.data ? Object.values(state.guides.data) : (Array.isArray(state.guides) ? state.guides : []);
  const changelogs = state.changelogs ? Object.values(state.changelogs) : [];
  const gn = state.generalNotes || {};
  const gnKeys = Object.keys(gn);
  $app.innerHTML = header() + `
    <section>
      <div class="section-header">🎯 海克斯联动玩法攻略 <small>${guides.length} 篇</small></div>
      ${guides.map(g => `
        <details class="feed-card">
          <summary><span>🎯 ${g.name}</span><span class="meta">${g.last_update || ""}</span></summary>
          <div class="feed-body">
            <p>${g.description || ""}</p>
            ${(g.augments || []).length ? `<div style="margin-top:8px">
              ${g.augments.map(a => `
                <div class="item-guide-card" style="margin-bottom:6px">
                  <div style="min-width:0"><div class="ig-name">${a.core ? "⭐" : "·"} ${a.name} ${a.core ? '<span class="aug-tag tag-core" style="margin-left:4px">核心</span>' : ""}</div>
                  ${a.reason ? `<div class="ig-reason">${a.reason}</div>` : ""}</div>
                </div>`).join("")}
            </div>` : ""}
            ${g.tips ? `<div class="tips-box" style="margin-left:0">💡 ${g.tips}</div>` : ""}
          </div>
        </details>`).join("")}
    </section>
    <section>
      <div class="section-header">📢 官方版本公告 <small>${changelogs.length} 条</small></div>
      ${changelogs.map(c => `
        <details class="feed-card">
          <summary><span>📢 ${c.title}</span><span class="meta">${c.section || ""}</span></summary>
          <div class="feed-body">
            ${(c.data || []).map(d => `<div class="chg"><b>${d.name || d.title || ""}</b><br>${d.changesHtml || d.content || ""}</div>`).join("")}
          </div>
        </details>`).join("")}
    </section>
    <section>
      <div class="section-header">🧩 通用方案联动说明 <small>${gnKeys.length} 套</small></div>
      ${gnKeys.map(k => `
        <details class="feed-card">
          <summary><span>🧩 ${k}</span></summary>
          <div class="feed-body">
            ${Object.entries(gn[k] || {}).map(([aug, note]) => `<div class="chg"><b>${aug}</b>：${note}</div>`).join("")}
          </div>
        </details>`).join("")}
    </section>
    <div class="meta">${guides.length} 攻略 · ${changelogs.length} 公告 · ${gnKeys.length} 方案说明</div>`;
  bindNav();
}

init().catch(e => { $app.innerHTML = "<pre style='color:#ff6b6b;padding:20px'>INIT ERROR: " + (e && e.stack || e) + "</pre>"; });
