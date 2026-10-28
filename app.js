// 海克斯大乱斗小助手 — 全免费 · 无广告 · 无会员
// 视觉与布局对齐原小程序(原版 CSS 类名复刻)
const $app = document.getElementById("app");
const DEPLOY_VER = "1793178161997";

const state = {
  view: "heroes", heroes: null, augments: null, items: null, rates: null, enums: null,
  currentHero: null, search: "", rankFilter: "all",
  relations: null, guides: null, builds: null, changelogs: null, generalNotes: null, listScroll: 0,
  heroStyles: null, styleFilter: "all", styleBuilds: null, currentStyle: "",
  refIndex: null, nameToSlug: null, refHeroCache: {}, refBuildIdx: 0,
};
const RARITY_CN = { prismatic: "棱彩", gold: "黄金", silver: "白银" };
const LIVE_RATES = "https://lolhaidou.cn/data/hero_augment_rates.json";
const FALLBACK_ICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect fill='%2316213a' width='40' height='40'/></svg>";

const REF_BASE = "assets/ref/";
function refFixUrls(obj) {
  // 深度遍历: 所有以 assets/ 开头的字符串 → 本地镜像路径
  if (typeof obj === "string") return obj.startsWith("assets/") ? REF_BASE + obj : obj;
  if (Array.isArray(obj)) return obj.map(refFixUrls);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = refFixUrls(v);
    return out;
  }
  return obj;
}
async function loadRefHero(slug) {
  if (state.refHeroCache[slug]) return state.refHeroCache[slug];
  const d = refFixUrls(await loadJSON("data/ref/heroes/" + slug + ".json"));
  state.refHeroCache[slug] = d;
  return d;
}

async function loadJSON(p) {
  const r = await fetch(p + (p.includes("?") ? "&" : "?") + "v=" + DEPLOY_VER, { cache: "no-cache" });
  return r.json();
}

async function init() {
  $app.innerHTML = '<div class="loading">召唤师数据载入中…</div>';
  const [heroes, augments, items, rates, enums, relations, guides, builds, changelogs, generalNotes, heroStyles, styleBuilds, refIndex, nameToSlug] = await Promise.all([
    loadJSON("data/heroes.json"), loadJSON("data/augments.json"), loadJSON("data/items.json"),
    loadJSON("data/augment-rates-snapshot.json").catch(() => null), loadJSON("data/enums.json").catch(() => ({})),
    loadJSON("data/hero-relations.json").catch(() => ({})), loadJSON("data/strategy-guides.json").catch(() => null),
    loadJSON("data/hero-builds.json").catch(() => ({})), loadJSON("data/lol-changelogs.json").catch(() => ({})),
    loadJSON("data/general-notes.json").catch(() => ({})), loadJSON("data/hero-styles.json").catch(() => ({})),
    loadJSON("data/hero-style-builds.json").catch(() => ({})),
    loadJSON("data/ref/index.json").catch(() => null),
    loadJSON("data/name-to-slug.json").catch(() => ({})),
  ]);
  Object.assign(state, { heroes, augments, items, rates, enums, relations, guides, builds, changelogs, generalNotes, heroStyles, styleBuilds, refIndex, nameToSlug });
  // INIT-CATCH marker
  // 懒加载英雄详情 JSON 缓存
  state.refHeroCache = {};
  if (rates) fetch(LIVE_RATES).then(r => r.json()).then(j => { if (j && j.heroCount) { state.rates = j; if (state.view === "heroes") renderHeroes(); } }).catch(() => {});
  const qs = new URLSearchParams(location.search);
  const urlHero = qs.get("hero");
  const urlStyle = qs.get("style");
  if (urlStyle) state.currentStyle = urlStyle;
  const urlView = qs.get("view");
  // hash 路由: #/hero/疾风剑豪 | #/augments | #/feed | #/heroes
  const hash = location.hash.replace(/^#\/?/, "");
  let routed = false;
  if (hash) {
    const parts = hash.split("/");
    if (parts[0] === "hero" && parts[1] && heroes[decodeURIComponent(parts[1])]) {
      if (parts[2]) state.currentStyle = decodeURIComponent(parts[2]);
      openHero(decodeURIComponent(parts[1]));
      routed = true;
    } else if (parts[0] === "augments") { renderAugments(); routed = true; }
    else if (parts[0] === "feed") { renderFeed(); routed = true; }
    else if (parts[0] === "heroes") { renderHeroes(); routed = true; }
  }
  if (!routed) {
    if (urlHero && heroes[urlHero]) openHero(urlHero);
    else if (urlView === "feed") renderFeed();
    else if (urlView === "augments") renderAugments();
    else renderHeroes();
  }
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
  if (location.hash && location.hash !== "#/heroes") history.replaceState(null, "", "#/heroes");
  const rates = state.rates?.data || {};
  const rows = Object.entries(state.heroes)
    .map(([name, h]) => ({ name, h, chg: h.winRateChange }))
    .filter(x => !state.search || x.name.includes(state.search) || (x.h.alias || []).some(a => a.toLowerCase().includes(state.search.toLowerCase())))
    .filter(x => state.styleFilter === "all" || (state.heroStyles?.heroStyles?.[x.name] || []).includes(state.styleFilter))
    .sort((a, b) => (b.h.winRate ?? 0) - (a.h.winRate ?? 0));
  $app.innerHTML = header() + `
    <div class="search-section"><div class="search-box-wrapper">
      <input class="search-input" placeholder="搜索英雄 / 别名（亚索、快乐风男、Yasuo…）" value="${state.search}">
      <span class="search-icon">🔍</span>
    </div></div>
    <div class="main-layout">
      <aside class="hero-pool">
        <div class="pool-title">🎭 流派英雄池</div>
        <div class="pool-styles">
          <div class="style-card ${state.styleFilter === "all" ? "active" : ""}" data-style="all">
            <div class="style-name">全部英雄</div>
            <div class="style-count">${Object.keys(state.heroes).length}</div>
          </div>
          ${Object.entries(state.heroStyles?.styleHeroes || {}).sort((a, b) => b[1].length - a[1].length).map(([s, arr]) => `
            <div class="style-card ${state.styleFilter === s ? "active" : ""}" data-style="${s}">
              <div class="style-name">${s}</div>
              <div class="style-count">${arr.length} 英雄</div>
            </div>`).join("")}
        </div>
      </aside>
      <div class="pool-content">
        <div class="hero-grid">
          ${rows.map(x => `
            <div class="hero-card" data-hero="${x.name}">
              <img src="${x.h.avatar}" loading="lazy" onerror="this.src='${FALLBACK_ICON}'">
              <div class="nm">${x.name}</div>
              <div class="wr">胜率 ${x.h.winRate != null ? x.h.winRate.toFixed(1) + "%" : "—"} ${changePct(x.chg)}</div>
              ${(state.heroStyles?.heroStyles?.[x.name] || []).length ? `<div class="mini-styles">${(state.heroStyles.heroStyles[x.name] || []).slice(0, 2).map(s => `<span>${s.replace(/（.*）/, "")}</span>`).join("")}</div>` : ""}
            </div>`).join("")}
        </div>
        <div class="meta">${state.styleFilter === "all" ? "共 " : "流派「" + state.styleFilter + "」共 "}${rows.length} 位英雄 · 胜率数据 ${state.rates?.update || "本地快照"}</div>
      </div>
    </div>`;
  const inp = $app.querySelector(".search-input");
  inp.oninput = e => { state.search = e.target.value; renderHeroes(); const n = $app.querySelector(".search-input"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  // 恢复列表滚动位置
  if (state.listScroll) { setTimeout(() => window.scrollTo({ top: state.listScroll }), 50); }
  $app.querySelectorAll("[data-hero]").forEach(c => c.onclick = () => { state.listScroll = window.scrollY; openHero(c.dataset.hero); });
  $app.querySelectorAll("[data-style]").forEach(c => c.onclick = () => { state.styleFilter = c.dataset.style; renderHeroes(); });
  bindNav();
}

/* ---------- 英雄详情 ---------- */
async function openHero(name, scroll = true) {
  const h = state.heroes[name];
  if (!h) return;
  state.currentHero = name; state.view = "hero";
  const slug = (state.nameToSlug || {})[name];
  if (slug) { const h2 = "#/hero/" + encodeURIComponent(name) + (state.currentStyle ? "/" + encodeURIComponent(state.currentStyle) : ""); if (location.hash !== h2) history.replaceState(null, "", h2); }
  const build = (state.builds || {})[name] || {};
  const sb = (state.styleBuilds || {})[name] || { styles: [], byStyle: {} };
  // 先渲染骨架(立刻可见), ref 数据到了再填充
  const refIdx = (state.refIndex || []).find(x => x.slug === slug);
  if (refIdx && refIdx.icon && refIdx.icon.startsWith("assets/")) refIdx.icon = REF_BASE + refIdx.icon;
  const hasRef = !!refIdx;
  const items = Object.entries(state.items).slice(0, 10).map(([k, v]) => ({ name: v.name || k, icon: v.icon, total: v.total }));
  const ig = build.itemGuide || [];
  const specials = (build.specialAugments || []).map(x => ({ ...x, ...(state.augments[x.name] || {}) }));
  const traps = (build.trapAugments || []).map(x => ({ ...x, ...(state.augments[x.name] || {}) }));
  const recs = (build.recommendations || []).map(x => ({ ...x, ...(state.augments[x.name] || {}) }));
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
    <div id="detailBody"><div class="loading">构筑数据载入中…</div></div>
    <button class="to-top" id="toTop" title="回到顶部">↑</button>`;
  document.getElementById("backBtn") && 0;
  $app.querySelectorAll("[data-goto]").forEach(el2 => el2.onclick = () => openHero(el2.dataset.goto));
  bindNav();
  if (scroll) window.scrollTo({ top: 0 });
  // 拉 ref 详情
  let ref = null;
  try { ref = slug ? await loadRefHero(slug) : null; } catch (e) { ref = null; }
  // ===== 渲染主体 =====
  const rank = ref?.rank || {};
  const refBuilds = ref?.builds || [];
  let body = `
    <div class="hero-header ref-hero">
      <img class="hero-avatar" src="${ref?.icon || h.avatar}" onerror="this.src='${FALLBACK_ICON}'">
      <div style="flex:1;min-width:0">
        <div class="hero-name">${name} <span style="font-size:13px;color:#8a93ad;font-weight:400">${ref?.title || ""}</span></div>
        <div class="hero-alias">${(h.alias || []).join(" / ")}</div>
        <div class="tags" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">
          ${(ref?.roles || []).map(t => `<span class="aug-tag" style="background:rgba(56,189,248,.12);color:#38bdf8;height:auto;padding:2px 8px">${t}</span>`).join("")}
          ${(h.position || []).map(t => `<span class="aug-tag" style="background:rgba(148,163,184,.1);color:#94a3b8;height:auto;padding:2px 8px">${t}</span>`).join("")}
        </div>
        ${ref?.order ? `<div style="margin-top:8px;font-size:12px;color:#8a93ad">技能加点: <b style="color:#f0e6d2">${ref.order}</b></div>` : ""}
      </div>
      <div class="wr-big">
        <div class="num">${rank.win != null ? rank.win.toFixed(1) + "%" : (h.winRate != null ? h.winRate.toFixed(1) + "%" : "—")}</div>
        <div class="lbl">真实对局胜率${rank.tier ? " · " + rank.tier + " 级" : ""}</div>
        ${rank.pick != null ? `<div class="lbl">选取 ${rank.pick.toFixed(1)}% · 样本 ${(rank.sample / 10000).toFixed(0)}万</div>` : ""}
        ${rank.blue != null ? `<div class="lbl">蓝 ${rank.blue.toFixed(1)}% / 红 ${rank.red.toFixed(1)}%</div>` : ""}
      </div>
    </div>`;
  // ===== 流派 Tab 构筑 =====
  if (refBuilds.length) {
    if (state.refBuildIdx >= refBuilds.length) state.refBuildIdx = 0;
    const b = refBuilds[state.refBuildIdx];
    body += `
    <div class="build-tabs">
      ${refBuilds.map((bb, i) => `
        <button class="build-tab ${i === state.refBuildIdx ? "active" : ""}" data-bidx="${i}">
          ${bb.n}
          <small>${bb.win != null ? bb.win.toFixed(1) + "% · " + bb.pick.toFixed(0) + "%登场" : ""}</small>
        </button>`).join("")}
    </div>
    <div class="build-panel glass-panel">
      <div class="build-sec">
        <div class="build-sec-title">🚀 出门装</div>
        <div class="asset-row">${(b.start || []).map(it => assetNode(it)).join("")}</div>
      </div>
      <div class="build-sec">
        <div class="build-sec-title">💎 核心装备</div>
        <div class="asset-row">${(b.core || []).map(it => assetNode(it)).join("")}</div>
      </div>
      <div class="build-sec">
        <div class="build-sec-title">🏆 六神装 <small>胜率 ${b.win != null ? b.win.toFixed(1) + "%" : "—"} · 登场 ${b.pick != null ? b.pick.toFixed(0) + "%" : "—"} · 样本 ${b.sample ? (b.sample / 10000).toFixed(0) + "万" : "—"}</small></div>
        <div class="asset-row">${(b.six || []).map(it => assetNode(it)).join("")}</div>
      </div>
      <div class="build-sec">
        <div class="build-sec-title">✨ 海克斯推荐</div>
        ${["p", "g", "s"].map((tier, ti) => {
          const label = ["棱彩", "黄金", "白银"][ti];
          const arr = b.augs?.[tier] || [];
          if (!arr.length) return "";
          return `<div class="tier-group">
            <div class="tier-label tier-${tier}">${label}</div>
            <div class="tier-augs">${arr.map(a => `
              <div class="tier-aug" title="${a.n}">
                <img src="${a.ic || (state.augments[a.n] || {}).icon || FALLBACK_ICON}" loading="lazy" onerror="this.src='${FALLBACK_ICON}'">
                <div class="ta-inf"><div class="ta-nm">${a.n}</div><div class="ta-st">${a.w != null ? a.w.toFixed(1) + "%" : "—"} · 选${a.p != null ? a.p.toFixed(1) + "%" : "—"}</div></div>
                <span class="aug-tag lvl-tag lvl-${(a.t || "").toLowerCase()}">${a.t || ""}</span>
              </div>`).join("")}
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }
  // ===== 原小程序数据补充: 特殊/陷阱/装备指南 =====
  if (specials.length) body += `<section><div class="section-header">💎 特殊海克斯联动 <small>海斗数据</small></div>${specials.map(x => augCard({ ...x, special: true })).join("")}</section>`;
  if (traps.length) body += `<section><div class="section-header">⚠️ 陷阱海克斯 <small>避坑</small></div>${traps.map(x => augCard({ ...x, trap: true })).join("")}</section>`;
  if (ig.length) body += `<section><div class="section-header">🛡️ 搭配装备指南 <small>${ig.filter(x => !x.trap).length} 推荐 / ${ig.filter(x => x.trap).length} 避坑</small></div><div class="item-guide-grid">${ig.map(it => `<div class="item-guide-card ${it.trap ? "trap" : ""}"><div style="min-width:0"><div class="ig-name">${it.trap ? "⛔" : "✅"} ${it.name}</div><div class="ig-reason">${it.reason || ""}${it.from ? " · " + it.from : ""}</div></div></div>`).join("")}</div></section>`;
  // ===== 技能/玩法要点 =====
  if (ref?.abil?.length) body += `<section><div class="section-header">📖 技能介绍 <small>加点 ${ref.order || "—"}</small></div>${ref.abil.map(ab => `<div class="item-guide-card" style="margin-bottom:6px"><img src="${ab.ic || FALLBACK_ICON}" style="width:36px;height:36px;border-radius:6px" onerror="this.style.visibility='hidden'"><div style="min-width:0"><div class="ig-name">[${ab.k}] ${ab.n}</div><div class="ig-reason">${ab.d || ""}</div></div></div>`).join("")}</section>`;
  if ((ref?.game || []).length) body += `<section><div class="section-header">💡 玩法要点</div>${ref.game.map(g => `<div class="chg-box">• ${g}</div>`).join("")}</section>`;
  if ((ref?.special || []).length) body += `<section><div class="section-header">🎪 特殊玩法</div>${ref.special.map(sp => `
    <div class="item-guide-card" style="margin-bottom:6px;flex-direction:column;align-items:stretch">
      <div class="ig-name">🎪 ${sp.n} <small style="color:#8a93ad;font-weight:400">${sp.cat || ""}</small></div>
      <div class="ig-reason">${sp.sum || ""}</div>
      ${(sp.req || []).length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${sp.req.map(r => `<span class="aug-tag" style="background:rgba(200,170,110,.12);color:#c8aa6e;height:auto;padding:2px 8px">需要: ${r.n}</span>`).join("")}</div>` : ""}
    </div>`).join("")}</section>`;
  // ===== 综合推荐(原小程序评分, 收进折叠) =====
  if (recs.length) body += `<details class="feed-card"><summary>🎯 综合推荐海克斯(评分版) <span class="meta">${recs.length} 条</span></summary><div class="feed-body">${recs.map(a => augCard(a)).join("")}</div></details>`;
  // 热门装备 + 版本改动
  body += `<section><div class="section-header">⚔️ 热门装备</div><div class="item-guide-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">${items.map(x => `<div class="item-guide-card"><img src="${x.icon || FALLBACK_ICON}" style="width:36px;height:36px;border-radius:6px" loading="lazy" onerror="this.src='${FALLBACK_ICON}'"><div><div class="ig-name">${x.name}</div><div class="ig-reason">${x.total ? "💰 " + x.total : ""}</div></div></div>`).join("")}</div></section>`;
  if ((h.changes || []).length) body += `<section><div class="section-header">📋 版本改动</div>${h.changes.map(c => `<div class="chg-box"><span class="aug-tag" style="background:rgba(56,189,248,.12);color:#38bdf8">${c.version}</span> <span style="font-size:12px;color:#8a93ad">${c.changesHtml || ""}</span></div>`).join("")}</section>`;
  body += `<div class="meta">真实对局数据: ${ref ? "海斗指南(16.21 · " + ((state.refIndex || []).find(x => x.slug === slug) ? "" : "") + ")" : "海斗"} · ${state.rates?.update || ""}</div>`;
  const bodyEl = document.getElementById("detailBody");
  if (bodyEl) bodyEl.innerHTML = body;
  // 绑定 build tab
  bodyEl.querySelectorAll("[data-bidx]").forEach(btn => btn.onclick = () => { state.refBuildIdx = +btn.dataset.bidx; openHero(name, false); });
  $app.querySelectorAll("[data-goto]").forEach(el2 => el2.onclick = () => openHero(el2.dataset.goto));
  const tt = document.getElementById("toTop");
  if (tt) tt.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  if (scroll) window.scrollTo({ top: 0 });
}

/* 装备节点(原版资产序列样式) */
function assetNode(it) {
  const icon = it.ic || (state.items[it.n] || {}).icon || FALLBACK_ICON;
  return `<div class="asset-node" title="${it.n}${it.w != null ? " · 胜率" + it.w.toFixed(1) + "%" : ""}${it.pr ? " · 💰" + it.pr : ""}">
    <img src="${icon}" loading="lazy" onerror="this.src='${FALLBACK_ICON}'">
    <span class="an-name">${it.n}</span>
    ${it.w != null ? `<span class="an-win">${it.w.toFixed(1)}%</span>` : ""}
    ${it.pr ? `<span class="an-price">${it.pr}</span>` : ""}
  </div>`;
}

/* ---------- 海克斯图鉴 ---------- */
function renderAugments() {
  if (location.hash !== "#/augments") history.replaceState(null, "", "#/augments");
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
  if (location.hash !== "#/feed") history.replaceState(null, "", "#/feed");
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

window.addEventListener("hashchange", () => {
  const h2 = location.hash.replace(/^#\/?/, "");
  const parts = h2.split("/");
  if (parts[0] === "hero" && parts[1] && state.heroes[decodeURIComponent(parts[1])]) {
    if (parts[2]) state.currentStyle = decodeURIComponent(parts[2]); else state.currentStyle = "";
    openHero(decodeURIComponent(parts[1]));
  } else if (parts[0] === "augments") renderAugments();
  else if (parts[0] === "feed") renderFeed();
  else if (parts[0] === "heroes") renderHeroes();
});
init().catch(e => { $app.innerHTML = "<pre style='color:#ff6b6b;padding:20px'>INIT ERROR: " + (e && e.stack || e) + "</pre>"; });
