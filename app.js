// 海克斯大乱斗小助手 — 全免费 · 无广告 · 无会员
// 数据: 海斗指南真实对局数据 + 海斗小程序特色联动数据
const $app = document.getElementById("app");
const DEPLOY_VER = "1793184819730";
const FALLBACK_ICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect fill='%23111721' width='40' height='40'/></svg>";

const state = {
  view: "heroes", heroes: null, augments: null, items: null, rates: null,
  relations: null, guides: null, builds: null, changelogs: null, generalNotes: null,
  heroStyles: null, styleBuilds: null, styleFilter: "all", listScroll: 0,
  refIndex: null, nameToSlug: null, refHeroCache: {}, refBuildIdx: 0,
  currentHero: null, search: "",
};
const RARITY_CN = { prismatic: "棱彩", gold: "金色", silver: "银色" };
const LIVE_RATES = "https://lolhaidou.cn/data/hero_augment_rates.json";
const REF_BASE = "assets/ref/";

async function loadJSON(p) {
  const r = await fetch(p + (p.includes("?") ? "&" : "?") + "v=" + DEPLOY_VER, { cache: "no-cache" });
  return r.json();
}

/* ref 资源路径 → 本地镜像 */
function refFix(obj) {
  if (typeof obj === "string") return obj.startsWith("assets/") ? obj.replace("assets/", REF_BASE) : obj;
  if (Array.isArray(obj)) return obj.map(refFix);
  if (obj && typeof obj === "object") { const o = {}; for (const [k, v] of Object.entries(obj)) o[k] = refFix(v); return o; }
  return obj;
}
async function loadRefHero(slug) {
  if (state.refHeroCache[slug]) return state.refHeroCache[slug];
  const d = refFix(await loadJSON("data/ref/heroes/" + slug + ".json"));
  state.refHeroCache[slug] = d;
  return d;
}

async function init() {
  $app.innerHTML = '<div class="loading">召唤师数据载入中…</div>';
  const [heroes, augments, items, rates, relations, guides, builds, changelogs, generalNotes, heroStyles, refIndex, nameToSlug] = await Promise.all([
    loadJSON("data/heroes.json"), loadJSON("data/augments.json"), loadJSON("data/items.json"),
    loadJSON("data/augment-rates-snapshot.json").catch(() => null),
    loadJSON("data/hero-relations.json").catch(() => ({})),
    loadJSON("data/strategy-guides.json").catch(() => null),
    loadJSON("data/hero-builds.json").catch(() => ({})),
    loadJSON("data/lol-changelogs.json").catch(() => ({})),
    loadJSON("data/general-notes.json").catch(() => ({})),
    loadJSON("data/hero-styles.json").catch(() => ({})),
    loadJSON("data/ref/index.json").catch(() => null),
    loadJSON("data/name-to-slug.json").catch(() => ({})),
  ]);
  Object.assign(state, { heroes, augments, items, rates, relations, guides, builds, changelogs, generalNotes, heroStyles, refIndex, nameToSlug });
  window.__state = state;
  if (rates) fetch(LIVE_RATES).then(r => r.json()).then(j => { if (j && j.heroCount) { state.rates = j; if (state.view === "heroes") renderHeroes(); } }).catch(() => {});
  // hash 路由
  const hash = location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/");
  let routed = false;
  if (parts[0] === "hero" && parts[1]) {
    const hn = decodeURIComponent(parts[1]);
    if (heroes[hn]) { if (parts[2]) state.currentStyle = decodeURIComponent(parts[2]); openHero(hn); routed = true; }
  } else if (parts[0] === "augments") { renderAugments(); routed = true; }
  else if (parts[0] === "feed") { renderFeed(); routed = true; }
  else if (parts[0] === "heroes") { renderHeroes(); routed = true; }
  if (!routed) {
    const qs = new URLSearchParams(location.search);
    const uh = qs.get("hero");
    if (uh && heroes[uh]) openHero(uh);
    else if (qs.get("view") === "feed") renderFeed();
    else renderHeroes();
  }
}

function setHash(h) { if (location.hash !== h) history.replaceState(null, "", h); }

function header() {
  return `<header class="topbar">
    <div class="tb-left"><div class="brand"><span class="brand-mark">⚔️</span><span class="brand-text">海克斯大乱斗小助手</span></div></div>
    <div class="search">
      <input id="globalSearch" type="search" placeholder="搜英雄 / 别名，如 yasuo" autocomplete="off" spellcheck="false" value="${state.search}">
      <button class="search-clear" id="qClear" aria-label="清空">✕</button>
    </div>
    <div class="tb-right"><span class="meta">全免费 · 无广告 · ${state.rates?.update || ""}</span></div>
  </header>`;
}
function bindChrome() {
  const inp = document.getElementById("globalSearch");
  if (inp) inp.oninput = e => { state.search = e.target.value; if (state.view === "heroes") renderHeroGrid(); };
  const qc = document.getElementById("qClear");
  if (qc) qc.onclick = () => { state.search = ""; renderView(); };
}
function renderView() {
  state.view === "augments" ? renderAugments() : state.view === "feed" ? renderFeed() : state.view === "hero" && state.currentHero ? openHero(state.currentHero, false) : renderHeroes();
}
function changePct(v) {
  if (v === undefined || v === null) return "";
  return `<span class="c-up${v < 0 ? "" : ""}" style="color:${v > 0 ? "var(--up)" : v < 0 ? "var(--down)" : "var(--dim)"};font-size:11px">${v > 0 ? "▲" : v < 0 ? "▼" : ""}${Math.abs(v).toFixed(2)}%</span>`;
}

/* ---------- 英雄列表(侧栏网格 + 主区) ---------- */
function heroPoolHTML() {
  const styles = Object.entries(state.heroStyles?.styleHeroes || {}).sort((a, b) => b[1].length - a[1].length);
  return `
  <div class="side-head"><span id="sideTitle">英雄池 · 流派过滤</span><span class="count">${Object.keys(state.heroes).length}</span></div>
  <div class="chips" style="padding:4px 2px 8px">
    <button class="chip ${state.styleFilter === "all" ? "on" : ""}" data-style="all">全部</button>
    ${styles.map(([s, arr]) => `<button class="chip ${state.styleFilter === s ? "on" : ""}" data-style="${s}">${s.replace(/（.*）/, "")} <i>${arr.length}</i></button>`).join("")}
  </div>
  <div class="hero-grid" id="heroGrid">${heroGridHTML()}</div>`;
}
function heroGridHTML() {
  const rates = state.rates?.data || {};
  const rows = Object.entries(state.heroes)
    .map(([name, h]) => ({ name, h }))
    .filter(x => !state.search || x.name.includes(state.search) || (x.h.alias || []).some(a => a.toLowerCase().includes(state.search.toLowerCase())))
    .filter(x => state.styleFilter === "all" || (state.heroStyles?.heroStyles?.[x.name] || []).includes(state.styleFilter))
    .sort((a, b) => (b.h.winRate ?? 0) - (a.h.winRate ?? 0));
  return rows.map(x => `
    <button class="hcard" data-hero="${x.name}">
      <img class="hc-img" src="${x.h.avatar}" loading="lazy" onerror="this.src='${FALLBACK_ICON}'">
      <span class="hc-nm">${x.name}</span>
      <span class="hc-wr">${x.h.winRate != null ? x.h.winRate.toFixed(1) + "%" : "—"}</span>
    </button>`).join("");
}
function renderHeroes() {
  setHash("#/heroes");
  state.view = "heroes"; state.currentHero = null;
  $app.innerHTML = header() + `
    <div class="layout">
      <aside class="sidebar" id="sidebar">${heroPoolHTML()}</aside>
      <main class="content">
        <div class="empty-state"><div class="empty-icon">⚔️</div><p>从左侧选择一个英雄，查看大乱斗构筑与海克斯推荐</p></div>
      </main>
    </div>`;
  bindChrome();
  $app.querySelectorAll("[data-style]").forEach(c => c.onclick = () => { state.styleFilter = c.dataset.style; renderHeroes(); });
  $app.querySelectorAll("[data-hero]").forEach(c => c.onclick = () => { state.listScroll = window.scrollY; openHero(c.dataset.hero); });
  if (state.listScroll) setTimeout(() => window.scrollTo({ top: state.listScroll }), 50);
}

/* ---------- 英雄详情(参照站结构) ---------- */
function assetNode(it, idx, isCore) {
  const icon = it.ic || (state.items[it.n] || {}).icon || FALLBACK_ICON;
  return `
    <button class="gitem ${isCore ? "is-core" : ""}" title="${it.n}${it.w != null ? " · 胜率 " + it.w.toFixed(1) + "%" : ""}${it.pr ? " · " + it.pr + " 金币" : ""}">
      <span class="gi-box"><img src="${icon}" loading="lazy" onerror="this.src='${FALLBACK_ICON}'">${idx != null ? `<i class="gi-idx">${idx}</i>` : ""}</span>
      <span class="gi-nm">${it.n}</span>
    </button>`;
}
function augRow(a, rk) {
  const rarity = a.rarity || "gold";
  const info = state.augments[a.name] || {};
  const icon = a.ic || info.icon || FALLBACK_ICON;
  const tier = a.level || a.tier || "";
  return `
    <button class="aug r-${rarity}" data-aug="${a.name}">
      <span class="aug-rk">${rk}</span>
      <span class="aug-ic"><img src="${icon}" loading="lazy" onerror="this.src='${FALLBACK_ICON}'"></span>
      <span class="aug-bd">
        <span class="aug-nm">${a.name}<em class="rar-tag r-${rarity}">${RARITY_CN[rarity] || rarity}</em></span>
        ${a.reason ? `<span class="aug-desc">${a.reason}</span>` : (a.description ? `<span class="aug-desc">${a.description}</span>` : "")}
        ${tier ? `<span class="aug-tier">${tier} 级</span>` : ""}
      </span>
      <span class="aug-w">${a.winRate != null ? a.winRate.toFixed(1) + "%<i>胜率</i>" : ""}</span>
      <span class="aug-p">${a.pickRate != null ? a.pickRate.toFixed(1) + "%<i>选取</i>" : ""}</span>
    </button>`;
}

async function openHero(name, scroll = true) {
  const h = state.heroes[name];
  if (!h) return;
  state.currentHero = name; state.view = "hero";
  const slug = (state.nameToSlug || {})[name];
  if (slug) setHash("#/hero/" + encodeURIComponent(name) + (state.currentStyle ? "/" + encodeURIComponent(state.currentStyle) : ""));
  const build = (state.builds || {})[name] || {};
  const sb = (state.styleBuilds || {})[name] || { styles: [], byStyle: {} };
  $app.innerHTML = header() + `
    <div class="layout">
      <aside class="sidebar" id="sidebar">
        <div class="side-head"><span>切换英雄</span><span class="count">${Object.keys(state.heroes).length}</span></div>
        <div class="hero-grid" id="heroGrid">${heroGridHTML()}</div>
      </aside>
      <main class="content" id="detailBody"><div class="loading">构筑数据载入中…</div></main>
    </div>`;
  bindChrome();
  $app.querySelectorAll("[data-hero]").forEach(c => c.onclick = () => openHero(c.dataset.hero));
  if (scroll) window.scrollTo({ top: 0 });
  let ref = null;
  try { ref = slug ? await loadRefHero(slug) : null; } catch (e) { ref = null; }
  const rank = ref?.rank || {};
  const refBuilds = ref?.builds || [];
  if (state.refBuildIdx >= refBuilds.length) state.refBuildIdx = 0;
  const recs = (build.recommendations || []).map(x => ({ ...x, ...(state.augments[x.name] || {}) }));
  const specials = (build.specialAugments || []).map(x => ({ ...x, ...(state.augments[x.name] || {}) }));
  const traps = (build.trapAugments || []).map(x => ({ ...x, ...(state.augments[x.name] || {}) }));
  const ig = build.itemGuide || [];
  // ===== 英雄头 =====
  let body = `
    <section class="hero-head">
      <div class="hh-glow"></div>
      <div class="hh-main">
        <div class="hh-avatar">
          <img src="${ref?.icon || h.avatar}" alt="${name}" onerror="this.src='${FALLBACK_ICON}'">
          <span class="hh-frame"></span>
          ${rank.tier ? `<span class="hh-tierline t-${rank.tier.toLowerCase()}">${rank.tier}</span>` : ""}
        </div>
        <div class="hh-id">
          <div class="hh-name"><h1>${name}</h1><span class="hh-title">${ref?.title || ""}</span></div>
          <div class="hh-tags">${(h.position || []).slice(0, 6).map(t => `<span class="hh-tag">${t}</span>`).join("")}</div>
          <div class="hh-stats">
            <div class="hs hs-wr"><b>${rank.win != null ? rank.win.toFixed(1) + "%" : (h.winRate != null ? h.winRate.toFixed(1) + "%" : "—")}</b><span>胜率</span></div>
            <div class="hs"><b>${rank.pick != null ? rank.pick.toFixed(1) + "%" : "—"}</b><span>选取率</span></div>
            ${rank.rank ? `<div class="hs"><b>#${rank.rank}</b><span>全站排名</span></div>` : ""}
            <div class="hs"><b>${rank.sample ? (rank.sample / 10000).toFixed(0) + "万" : "—"}</b><span>对局样本</span></div>
          </div>
        </div>
        <div class="hh-side">
          ${ref?.order ? `<div class="hh-box"><span class="hb-lb">技能加点</span><div class="hb-row"><span class="order-txt">${ref.order}</span>${(ref.abil || []).map(ab => `<span class="ab-ic" title="${ab.n}"><img src="${ab.ic}" loading="lazy" onerror="this.style.visibility='hidden'"><i>${ab.k}</i></span>`).join("")}</div></div>` : ""}
        </div>
      </div>
    </section>`;
  // ===== 流派 Tab =====
  if (refBuilds.length) {
    if (state.refBuildIdx >= refBuilds.length) state.refBuildIdx = 0;
    const b = refBuilds[state.refBuildIdx];
    body += `<nav class="play-tabs" id="playTabs">
      ${refBuilds.map((bb, i) => `<button class="pt ${i === state.refBuildIdx ? "on" : ""}" data-bidx="${i}"><span class="pt-n">${bb.n}</span><span class="pt-w">${bb.win != null ? bb.win.toFixed(1) + "%" : ""}</span></button>`).join("")}
    </nav>`;
    // 出装
    body += `<section class="sec" id="sec-gear">
      <div class="sec-head"><h3>推荐出装</h3><span class="sec-sub">胜率 <b>${b.win != null ? b.win.toFixed(1) + "%" : "—"}</b> · 选取 <b>${b.pick != null ? b.pick.toFixed(0) + "%" : "—"}</b> · 样本 ${b.sample ? (b.sample / 10000).toFixed(0) + "万" : "—"}</span><div class="sec-line"></div></div>
      <div class="gear-box">
        <div class="gear-row"><div class="gear-lb">出门装</div><div class="gear-items">${(b.start || []).map(it => assetNode(it)).join("")}</div></div>
        <div class="gear-row"><div class="gear-lb">六件成装<i>前 3 件为核心</i></div><div class="gear-items">${(b.six || []).map((it, i) => assetNode(it, i + 1, i < 3)).join("")}</div></div>
      </div>
    </section>`;
    // 海克斯分级
    const tiers = [["p", "棱彩", "prismatic"], ["g", "金色", "gold"], ["s", "银色", "silver"]];
    body += `<section class="sec" id="sec-aug">
      <div class="sec-head"><h3>海克斯推荐</h3><span class="sec-sub">按本英雄胜率排序</span><div class="sec-line"></div></div>
      ${tiers.map(([t, label, rar]) => {
        const arr = b.augs?.[t] || [];
        if (!arr.length) return "";
        return `<div class="aug-group">
          <div class="ag-lb"><span class="rar-dot r-${rar}"></span>${label}<i>${arr.length}</i></div>
          <div class="aug-list">${arr.map((a, i) => augRow({ name: a.n, rarity: a.r, level: a.t, winRate: a.w, pickRate: a.p, ic: a.ic }, i + 1)).join("")}</div>
        </div>`;
      }).join("")}
    </section>`;
  }
  // ===== 特殊/陷阱(海斗特色) =====
  if (specials.length) body += `<section class="sec"><div class="sec-head"><h3>💎 特殊海克斯联动</h3><span class="sec-sub">拿到强度爆炸</span><div class="sec-line"></div></div><div class="aug-list">${specials.map((x, i) => augRow({ ...x, special: true }, i + 1)).join("")}</div></section>`;
  if (traps.length) body += `<section class="sec"><div class="sec-head"><h3>⚠️ 陷阱海克斯</h3><span class="sec-sub">避坑</span><div class="sec-line"></div></div><div class="aug-list">${traps.map((x, i) => augRow({ ...x, trap: true }, i + 1)).join("")}</div></section>`;
  if (ig.length) body += `<section class="sec"><div class="sec-head"><h3>🛡️ 搭配装备指南</h3><span class="sec-sub">${ig.filter(x => !x.trap).length} 推荐 / ${ig.filter(x => x.trap).length} 避坑</span><div class="sec-line"></div></div><div class="item-guide-grid">${ig.map(it => `<div class="item-guide-card ${it.trap ? "trap" : ""}"><div style="min-width:0"><div class="ig-name">${it.trap ? "⛔" : "✅"} ${it.name}</div><div class="ig-reason">${it.reason || ""}${it.from ? " · " + it.from : ""}</div></div></div>`).join("")}</div></section>`;
  // ===== 技能/玩法/特殊玩法 =====
  if (ref?.abil?.length) body += `<section class="sec"><div class="sec-head"><h3>📖 技能介绍</h3><span class="sec-sub">加点 ${ref.order || "—"}</span><div class="sec-line"></div></div><div class="skill-list">${ref.abil.map(ab => `<div class="skill"><img class="sk-ic" src="${ab.ic}" loading="lazy" onerror="this.style.visibility='hidden'"><div class="sk-bd"><div class="ig-name">[${ab.k}] ${ab.n}</div><div class="ig-reason">${ab.d || ""}</div></div></div>`).join("")}</div></section>`;
  if ((ref?.game || []).length) body += `<section class="sec"><div class="sec-head"><h3>💡 常规玩法</h3><div class="sec-line"></div></div><div class="game-list">${ref.game.map(g => `<div class="tip">• ${g}</div>`).join("")}</div></section>`;
  if ((ref?.special || []).length) body += `<section class="sec"><div class="sec-head"><h3>🎪 特殊玩法</h3><span class="sec-sub">${ref.special.length} 套</span><div class="sec-line"></div></div>${ref.special.map(sp => `
    <div class="sp-card">
      <div class="sp-hd"><span class="sp-cat">${sp.cat || "特殊玩法"}</span><b>${sp.n}</b></div>
      <div class="sp-sum">${sp.sum || ""}</div>
      ${(sp.req || []).length ? `<div class="sp-lb">触发条件</div><div class="sp-augs">${sp.req.map(r => `<span class="amini"><img src="${r.ic}" loading="lazy" onerror="this.style.visibility='hidden'">${r.n}</span>`).join("")}</div>` : ""}
    </div>`).join("")}</section>`;
  // ===== 折叠区: 综合评分/装备/版本改动 =====
  if (recs.length) body += `<details class="feed-card"><summary>🎯 综合推荐海克斯(评分版) <span class="meta">${recs.length} 条</span></summary><div class="feed-body">${recs.map((a, i) => augRow(a, i + 1)).join("")}</div></details>`;
  body += `<details class="feed-card"><summary>⚔️ 热门装备</summary><div class="feed-body"><div class="item-guide-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${Object.entries(state.items).slice(0, 12).map(([k, v]) => `<div class="item-guide-card"><img src="${v.icon || FALLBACK_ICON}" style="width:32px;height:32px;border-radius:6px" loading="lazy" onerror="this.src='${FALLBACK_ICON}'"><div><div class="ig-name">${v.name || k}</div><div class="ig-reason">${v.total ? "💰 " + v.total : ""}</div></div></div>`).join("")}</div></div></details>`;
  if ((h.changes || []).length) body += `<details class="feed-card"><summary>📋 版本改动</summary><div class="feed-body">${h.changes.map(c => `<div class="chg"><b>${c.version}</b> ${c.changesHtml || ""}</div>`).join("")}</div></details>`;
  body += `<div class="meta">真实对局数据 · ${state.rates?.update || ""} · 全免费无广告</div>`;
  const bodyEl = document.getElementById("detailBody");
  if (bodyEl) bodyEl.innerHTML = body;
  bodyEl.querySelectorAll("[data-bidx]").forEach(btn => btn.onclick = () => { state.refBuildIdx = +btn.dataset.bidx; openHero(name, false); });
  $app.querySelectorAll("[data-hero]").forEach(c => c.onclick = () => openHero(c.dataset.hero));
  const tt = document.getElementById("toTop");
  if (tt) tt.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  if (scroll) window.scrollTo({ top: 0 });
}

/* ---------- 海克斯图鉴 ---------- */
function renderAugments() {
  setHash("#/augments");
  state.view = "augments";
  const all = Object.entries(state.augments).map(([name, a]) => ({ name, ...a }));
  const filtered = all
    .filter(a => state.rankFilter === "all" || a.rarity === state.rankFilter)
    .filter(a => !state.search || a.name.includes(state.search) || (a.description || "").includes(state.search))
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0));
  $app.innerHTML = header() + `
    <div class="layout">
      <aside class="sidebar" id="sidebar">${heroPoolHTML()}</aside>
      <main class="content">
        <div class="sec-head"><h3>海克斯图鉴</h3><span class="sec-sub">共 ${filtered.length} 个</span><div class="sec-line"></div>
        <div class="chips">
          ${[["all", "全部"], ["prismatic", "棱彩"], ["gold", "金色"], ["silver", "银色"]].map(([v, l]) => `<button class="chip ${state.rankFilter === v ? "on" : ""}" data-rank="${v}">${l}</button>`).join("")}
        </div></div>
        <div class="aug-list" style="margin-top:12px">
          ${filtered.map((a, i) => augRow(a, i + 1)).join("")}
        </div>
      </main>
    </div>`;
  bindChrome();
  $app.querySelectorAll("[data-rank]").forEach(b => b.onclick = () => { state.rankFilter = b.dataset.rank; renderAugments(); });
}

/* ---------- 攻略·公告 ---------- */
function renderFeed() {
  setHash("#/feed");
  state.view = "feed";
  const guides = state.guides?.data ? Object.values(state.guides.data) : (Array.isArray(state.guides) ? state.guides : []);
  const changelogs = state.changelogs ? Object.values(state.changelogs) : [];
  const gn = state.generalNotes || {};
  const gnKeys = Object.keys(gn);
  $app.innerHTML = header() + `
    <div class="layout">
      <aside class="sidebar" id="sidebar">${heroPoolHTML()}</aside>
      <main class="content">
        <section class="sec"><div class="sec-head"><h3>🎯 海克斯联动玩法攻略</h3><span class="sec-sub">${guides.length} 篇</span><div class="sec-line"></div></div>
        ${guides.map(g => `
          <details class="feed-card"><summary>🎯 ${g.name}<span class="meta">${g.last_update || ""}</span></summary>
          <div class="feed-body"><p>${g.description || ""}</p>
          ${(g.augments || []).map(a => `<div class="item-guide-card" style="margin-bottom:6px"><div style="min-width:0"><div class="ig-name">${a.core ? "⭐" : "·"} ${a.name} ${a.core ? '<span class="aug-tag tag-core" style="margin-left:4px">核心</span>' : ""}</div>${a.reason ? `<div class="ig-reason">${a.reason}</div>` : ""}</div></div>`).join("")}
          ${g.tips ? `<div class="tips-box" style="margin-left:0">💡 ${g.tips}</div>` : ""}</div></details>`).join("")}
        </section>
        <section class="sec"><div class="sec-head"><h3>📢 官方版本公告</h3><span class="sec-sub">${changelogs.length} 条</span><div class="sec-line"></div></div>
        ${changelogs.map(c => `` + `
          <details class="feed-card"><summary>📢 ${c.title}<span class="meta">${c.section || ""}</span></summary>
          <div class="feed-body">${(c.data || []).map(d => `<div class="chg"><b>${d.name || d.title || ""}</b><br>${d.changesHtml || d.content || ""}</div>`).join("")}</div></details>`).join("")}
        </section>
        <section class="sec"><div class="sec-head"><h3>🧩 通用方案联动说明</h3><span class="sec-sub">${gnKeys.length} 套</span><div class="sec-line"></div></div>
        ${gnKeys.map(k => `` + `
          <details class="feed-card"><summary>🧩 ${k}</summary><div class="feed-body">${Object.entries(gn[k] || {}).map(([aug, note]) => `<div class="chg"><b>${aug}</b>：${note}</div>`).join("")}</div></details>`).join("")}
        </section>
        <div class="meta">${guides.length} 攻略 · ${changelogs.length} 公告 · ${gnKeys.length} 方案说明</div>
      </main>
    </div>`;
  bindChrome();
}

window.addEventListener("hashchange", () => {
  const h2 = location.hash.replace(/^#\/?/, "");
  const parts = h2.split("/");
  if (parts[0] === "hero" && parts[1]) {
    const hn = decodeURIComponent(parts[1]);
    if (state.heroes[hn]) { if (parts[2]) state.currentStyle = decodeURIComponent(parts[2]); else state.currentStyle = ""; openHero(hn); }
  } else if (parts[0] === "augments") renderAugments();
  else if (parts[0] === "feed") renderFeed();
  else if (parts[0] === "heroes") renderHeroes();
});

init().catch(e => { $app.innerHTML = "<pre style='color:#f0716a;padding:20px'>INIT ERROR: " + (e && e.stack || e) + "</pre>"; });
