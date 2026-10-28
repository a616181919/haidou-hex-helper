// 海克斯大乱斗小助手 — 全免费 · 无广告 · 无会员
const $app = document.getElementById("app");

const state = {
  view: "heroes",           // heroes | hero | augments
  heroes: null, augments: null, items: null, rates: null, enums: null,
  currentHero: null,
  search: "",
  rankFilter: "all",        // all | prismatic | gold | silver
  relations: null, guides: null, builds: null, changelogs: null, generalNotes: null,
};

const RARITY_CN = { prismatic: "棱彩", gold: "黄金", silver: "白银" };
const LIVE_RATES = "https://lolhaidou.cn/data/hero_augment_rates.json";

async function loadJSON(p) { const r = await fetch(p); return r.json(); }

async function init() {
  $app.innerHTML = '<div class="loading">召唤师数据载入中…</div>';
  const [heroes, augments, items, rates, enums, relations, guides, builds, changelogs, generalNotes] = await Promise.all([
    loadJSON("data/heroes.json"),
    loadJSON("data/augments.json"),
    loadJSON("data/items.json"),
    loadJSON("data/augment-rates-snapshot.json").catch(() => null),
    loadJSON("data/enums.json").catch(() => ({})),
    loadJSON("data/hero-relations.json").catch(() => ({})),
    loadJSON("data/strategy-guides.json").catch(() => null),
    loadJSON("data/hero-builds.json").catch(() => ({})),
    loadJSON("data/lol-changelogs.json").catch(() => ({})),
    loadJSON("data/general-notes.json").catch(() => ({})),
  ]);
  state.heroes = heroes; state.augments = augments; state.items = items;
  state.rates = rates; state.enums = enums;
  state.relations = relations; state.guides = guides; state.builds = builds;
  state.changelogs = changelogs; state.generalNotes = generalNotes;
  // 在线刷新胜率(静默, 失败用快照)
  if (rates) {
    fetch(LIVE_RATES).then(r => r.json()).then(j => {
      if (j && j.heroCount) { state.rates = j; if (state.view === "heroes") renderHeroes(); }
    }).catch(() => {});
  }
  const urlHero = new URLSearchParams(location.search).get("hero");
  if (urlHero && heroes[urlHero]) { openHero(urlHero); } else { renderHeroes(); }
}

function header() {
  return `<header>
    <h1>⚔️ 海克斯大乱斗小助手<small>全免费 · 无广告 · 数据每周同步</small></h1>
    <nav>
      <button class="${state.view === "heroes" || state.view === "hero" ? "active" : ""}" data-nav="heroes">英雄推荐</button>
      <button class="${state.view === "augments" ? "active" : ""}" data-nav="augments">海克斯图鉴</button>
      <button class="${state.view === "feed" ? "active" : ""}" data-nav="feed">攻略·公告</button>
    </nav>
  </header>`;
}

function bindNav() {
  $app.querySelectorAll("[data-nav]").forEach(b => b.onclick = () => {
    state.view = b.dataset.nav; state.currentHero = null;
    state.view === "augments" ? renderAugments() : state.view === "feed" ? renderFeed() : renderHeroes();
  });
}

function changePct(v) {
  if (v === undefined || v === null) return "";
  const cls = v > 0 ? "up" : v < 0 ? "down" : "";
  const sign = v > 0 ? "▲" : v < 0 ? "▼" : "";
  return `<span class="wr ${cls}">${sign}${Math.abs(v).toFixed(2)}%</span>`;
}


/* 搭配装备指南 + 玩法心得(从推荐海克斯的联动数据聚合) */
function buildItemGuide(rel) {
  const itemSet = new Map();
  for (const sa of (rel.specialAugments || [])) {
    const info = state.augments[sa.name] || {};
    for (const it of (info.specialItems || [])) {
      if (!itemSet.has(it.name)) itemSet.set(it.name, { name: it.name, reason: it.reason, from: sa.name, trap: false });
    }
    for (const it of (info.trapItems || [])) {
      const key = "trap_" + it.name;
      if (!itemSet.has(key)) itemSet.set(key, { name: it.name, reason: it.reason, from: sa.name, trap: true });
    }
  }
  const arr = [...itemSet.values()];
  if (!arr.length) return "";
  return `<section>
    <h3>🛡️ 搭配装备指南（基于推荐海克斯联动）</h3>
    <div class="item-grid">
      ${arr.map(it => `
        <div class="item-card ${it.trap ? "trap-item" : ""}">
          <div style="min-width:0">
            <div class="nm">${it.trap ? "⛔" : "✅"} ${it.name}</div>
            <div class="ds" style="font-size:11px;color:var(--muted);margin-top:2px">${it.reason || ""}${it.from ? " · " + it.from : ""}</div>
          </div>
        </div>`).join("")}
    </div>
  </section>`;
}
function buildTips(rel) {
  const tips = (rel.specialAugments || []).map(x => state.augments[x.name]).filter(a => a && a.tips);
  if (!tips.length) return "";
  return `<section>
    <h3>💡 玩法心得</h3>
    ${tips.map(a => `<div class="chg"><b>【${a.name}】</b>${a.tips}</div>`).join("")}
  </section>`;
}


/* ---------- 攻略·公告 ---------- */
function renderFeed() {
  const guides = state.guides?.data ? Object.values(state.guides.data) : (Array.isArray(state.guides) ? state.guides : []);
  const changelogs = state.changelogs ? Object.values(state.changelogs) : [];
  const gn = state.generalNotes || {};
  const gnKeys = Object.keys(gn);
  $app.innerHTML = header() + `
    <section>
      <h3>🎯 海克斯联动玩法攻略（${guides.length}）</h3>
      <div class="feed-list">
        ${guides.map(g => `
          <details class="feed-card">
            <summary><b>${g.name}</b><span class="meta">${g.last_update || ""}</span></summary>
            <div class="feed-body">
              <p>${g.description || ""}</p>
              ${(g.augments || []).length ? `<div class="aug-list" style="margin-top:8px">
                ${g.augments.map(a => `
                  <div class="aug-item" style="padding:8px 10px">
                    <div class="inf">
                      <div class="nm">${a.core ? "⭐" : "·"} ${a.name} ${a.core ? '<span class="tag">核心</span>' : ""}</div>
                      ${a.reason ? `<div class="ds">${a.reason}</div>` : ""}
                    </div>
                  </div>`).join("")}
              </div>` : ""}
              ${g.tips ? `<div class="chg" style="margin-top:8px">💡 ${g.tips}</div>` : ""}
            </div>
          </details>`).join("")}
      </div>
    </section>
    <section>
      <h3>📢 官方版本公告（${changelogs.length}）</h3>
      <div class="feed-list">
        ${changelogs.map(c => `
          <details class="feed-card">
            <summary><b>${c.title}</b><span class="meta">${c.section || ""}</span></summary>
            <div class="feed-body">
              ${(c.data || []).map(d => `
                <div class="chg" style="margin:6px 0"><b>${d.name || d.title || ""}</b><br>${d.changesHtml || d.content || ""}</div>`).join("")}
            </div>
          </details>`).join("")}
      </div>
    </section>
    <section>
      <h3>🧩 通用方案海克斯联动说明（${gnKeys.length}）</h3>
      <div class="feed-list">
        ${gnKeys.map(k => `
          <details class="feed-card">
            <summary><b>${k}</b></summary>
            <div class="feed-body">
              ${Object.entries(gn[k] || {}).map(([aug, note]) => `<div class="chg" style="margin:4px 0"><b>${aug}</b>：${note}</div>`).join("")}
            </div>
          </details>`).join("")}
      </div>
    </section>
    <div class="meta">共 ${guides.length} 篇攻略 · ${changelogs.length} 条公告 · ${gnKeys.length} 套方案说明</div>`;
  bindNav();
}

/* ---------- 英雄列表 ---------- */
function renderHeroes() {
  const heroes = Object.entries(state.heroes);
  const rates = state.rates?.data || {};
  const rows = heroes
    .map(([name, h]) => {
      const r = rates[name] || [];
      const top = r[0];
      return { name, h, topWin: top ? top.winRate : null, wr: h.winRate, chg: h.winRateChange };
    })
    .filter(x => !state.search || x.name.includes(state.search) || (x.h.alias || []).some(a => a.toLowerCase().includes(state.search.toLowerCase())))
    .sort((a, b) => (b.wr ?? 0) - (a.wr ?? 0));
  $app.innerHTML = header() + `
    <input class="search" placeholder="搜索英雄 / 别名（如：亚索、快乐风男、Yasuo）" value="${state.search}">
    <div class="grid">
      ${rows.map(x => `
        <div class="hero-card" data-hero="${x.name}">
          <img src="${x.h.avatar}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22><rect fill=%22%2316213a%22 width=%2264%22 height=%2264%22/></svg>'">
          <div class="nm">${x.name}</div>
          <div class="wr">胜率 ${x.wr != null ? x.wr.toFixed(1) + "%" : "—"} ${changePct(x.chg)}</div>
        </div>`).join("")}
    </div>
    <div class="meta">共 ${rows.length} 位英雄 · 胜率数据 ${state.rates?.update || "本地快照"}</div>`;
  $app.querySelector(".search").oninput = e => { state.search = e.target.value; renderHeroes(); const inp = $app.querySelector(".search"); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); };
  $app.querySelectorAll("[data-hero]").forEach(c => c.onclick = () => openHero(c.dataset.hero));
  bindNav();
}

/* ---------- 英雄详情 ---------- */
function openHero(name) {
  const h = state.heroes[name];
  if (!h) return;
  state.currentHero = name;
  state.view = "hero";
  // 使用预计算的构筑卡(原版评分算法离线生成)
  const build = (state.builds || {})[name] || {};
  const rel2 = build;
  const merged = (build.recommendations || []).map(x => ({ ...x, ...(state.augments[x.name] || {}) }));
  // 装备: 与该英雄别名相关的出装(简单关联: 从 items 全集展示常用分类)
  const items = Object.entries(state.items).slice(0, 12).map(([k, v]) => ({ name: v.name || k, icon: v.icon, total: v.total }));
  const rel = { specialAugments: build.specialAugments || [], trapAugments: build.trapAugments || [] };
  $app.innerHTML = header() + `
    <button class="back" id="backBtn">← 返回英雄列表</button>
    <div class="detail-hero">
      <img src="${h.avatar}" onerror="this.style.visibility='hidden'">
      <div>
        <h2>${name}</h2>
        <div class="tags">${(h.position || []).map(t => `<span class="tag">${t}</span>`).join("")}</div>
        <div class="chg" style="margin-top:6px">别名: ${(h.alias || []).join(" / ")}</div>
      </div>
      <div class="wr-big">
        <div class="num">${h.winRate != null ? h.winRate.toFixed(1) + "%" : "—"}</div>
        <div class="lbl">大乱斗胜率 ${changePct(h.winRateChange)}</div>
        <div class="lbl" style="margin-top:4px"><span class="lvl lvl-s">S</span> ${build.sCount || 0} · <span class="lvl lvl-a">A</span> ${build.aCount || 0} · 共 ${build.total || 0} 海克斯</div>
      </div>
    </div>
    <section>
      <h3>🎯 海克斯推荐（按胜率排序）</h3>
      <div class="aug-list">
        ${merged.length ? merged.slice(0, 30).map((a, i) => `
          <div class="aug-item">
            <img src="${a.icon || ""}" loading="lazy" onerror="this.style.visibility='hidden'">
            <div class="inf">
              <div class="nm">${i + 1}. ${a.name}
                ${a.level ? `<span class="lvl lvl-${a.level.toLowerCase()}">${a.level}</span>` : ""}
                ${a.hot ? `<span class="hot">🔥热门</span>` : ""}
                ${a.rarity ? `<span class="rarity r-${a.rarity}">${RARITY_CN[a.rarity] || a.rarity}</span>` : ""}
              </div>
              ${a.description ? `<div class="ds">${a.description}</div>` : ""}
            </div>
            <div class="pct"><b>${a.winRate != null ? a.winRate.toFixed(1) + "%" : "—"}</b><span>选取 ${a.pickRate != null ? a.pickRate.toFixed(1) + "%" : "—"} ${a.score ? "· 评" + a.score : ""}</span></div>
          </div>`).join("") : '<div class="loading">暂无该英雄的海克斯数据</div>'}
      </div>
    </section>
    <section>
      <h3>⚔️ 热门装备</h3>
      <div class="item-grid">
        ${items.map(x => `
          <div class="item-card">
            <img src="${x.icon || ""}" loading="lazy" onerror="this.style.visibility='hidden'">
            <div><div class="nm">${x.name}</div><div class="pr">${x.total ? "💰 " + x.total : ""}</div></div>
          </div>`).join("")}
      </div>
    </section>

    
    <section>
      <h3>💎 特殊海克斯联动（拿了大乱斗强度爆炸）</h3>
      <div class="aug-list">
        ${(rel.specialAugments || []).length ? rel.specialAugments.map(x => {
          const info = state.augments[x.name] || {};
          return `
          <div class="aug-item">
            <img src="${info.icon || ""}" loading="lazy" onerror="this.style.visibility='hidden'">
            <div class="inf">
              <div class="nm">${x.name} ${info.rarity ? `<span class="rarity r-${info.rarity}">${RARITY_CN[info.rarity] || info.rarity}</span>` : ""}</div>
              ${x.reason ? `<div class="ds">${x.reason}</div>` : (info.description ? `<div class="ds">${info.description}</div>` : "")}
            </div>
          </div>`;
        }).join("") : '<div class="loading">暂无数据</div>'}
      </div>
    </section>
    ${(rel.trapAugments || []).length ? `<section>
      <h3>⚠️ 陷阱海克斯（避坑）</h3>
      <div class="aug-list">
        ${rel.trapAugments.map(x => {
          const info = state.augments[x.name] || {};
          return `
          <div class="aug-item trap">
            <img src="${info.icon || ""}" loading="lazy" onerror="this.style.visibility='hidden'">
            <div class="inf">
              <div class="nm">${x.name} ${info.rarity ? `<span class="rarity r-${info.rarity}">${RARITY_CN[info.rarity] || info.rarity}</span>` : ""}</div>
              ${x.reason ? `<div class="ds">${x.reason}</div>` : ""}
            </div>
          </div>`;
        }).join("")}
      </div>
    </section>` : ""}
    ${(rel.specialAugments || []).length ? (() => {
      const itemSet = new Map();
      for (const sa of rel.specialAugments) {
        const info = state.augments[sa.name] || {};
        for (const it of (info.specialItems || [])) {
          if (!itemSet.has(it.name)) itemSet.set(it.name, { name: it.name, reason: it.reason, from: sa.name });
        }
        for (const it of (info.trapItems || [])) {
          if (!itemSet.has("trap_" + it.name)) itemSet.set("trap_" + it.name, { name: it.name, reason: it.reason, trap: true, from: sa.name });
        }
      }
      const arr = [...itemSet.values()];
      if (!arr.length) return "";
      return `<section>
        <h3>🛡️ 搭配装备指南（基于本英雄推荐海克斯）</h3>
        <div class="item-grid">
          ${arr.map(it => `
            <div class="item-card ${it.trap ? "trap-item" : ""}">
              <div style="min-width:0">
                <div class="nm">${it.trap ? "⛔" : "✅"} ${it.name}</div>
                <div class="ds" style="font-size:11px;color:var(--muted);margin-top:2px">${it.reason || ""}${it.from ? " · " + it.from : ""}</div>
              </div>
            </div>`).join("")}
        </div>
      </section>`;
    })() : ""}
    ${(() => {
      const tips = (rel.specialAugments || []).map(x => state.augments[x.name]).filter(a => a && a.tips);
      if (!tips.length) return "";
      return `<section>
        <h3>💡 玩法心得</h3>
        ${tips.map(a => `<div class="chg"><b>【${a.name}】</b>${a.tips}</div>`).join("")}
      </section>`;
    })()}

    ${(h.changes && h.changes.length) ? `<section><h3>📋 版本改动</h3>
      ${h.changes.map(c => `<div class="chg"><b>${c.version}</b> · ${c.changesHtml}</div>`).join("")}
    </section>` : ""}
    <div class="meta">数据来源: 海斗公开数据 · 每周同步</div>`;
  document.getElementById("backBtn").onclick = () => { state.view = "heroes"; renderHeroes(); };
  bindNav();
}

/* ---------- 海克斯图鉴 ---------- */
function renderAugments() {
  const all = Object.entries(state.augments).map(([name, a]) => ({ name, ...a }));
  const filtered = all
    .filter(a => state.rankFilter === "all" || a.rarity === state.rankFilter)
    .filter(a => !state.search || a.name.includes(state.search) || (a.description || "").includes(state.search))
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0));
  $app.innerHTML = header() + `
    <input class="search" placeholder="搜索海克斯名称 / 效果描述" value="${state.search}">
    <div class="rank-tabs">
      ${[["all", "全部"], ["prismatic", "棱彩"], ["gold", "黄金"], ["silver", "白银"]].map(([v, l]) =>
        `<button class="${state.rankFilter === v ? "active" : ""}" data-rank="${v}">${l}</button>`).join("")}
    </div>
    <div class="augment-grid">
      ${filtered.map(a => `
        <div class="aug-item">
          <img src="${a.icon || ""}" loading="lazy" onerror="this.style.visibility='hidden'">
          <div class="inf">
            <div class="nm">${a.name} ${a.rarity ? `<span class="rarity r-${a.rarity}">${RARITY_CN[a.rarity] || a.rarity}</span>` : ""}</div>
            <div class="ds">${a.description || ""}</div>
          </div>
          <div class="pct"><b>${a.winRate != null ? a.winRate.toFixed(1) + "%" : "—"}</b><span>胜率</span></div>
        </div>`).join("")}
    </div>
    <div class="meta">共 ${filtered.length} 个海克斯</div>`;
  $app.querySelector(".search").oninput = e => { state.search = e.target.value; renderAugments(); const inp = $app.querySelector(".search"); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); };
  $app.querySelectorAll("[data-rank]").forEach(b => b.onclick = () => { state.rankFilter = b.dataset.rank; renderAugments(); });
  bindNav();
}

init();
