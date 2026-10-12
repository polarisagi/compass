// 北极星画像 · 页面逻辑
// 所有数据只保存在浏览器的 localStorage 里，没有任何网络请求。
import { IPIP50, ONET, MOOD, INTERVIEW, PENDING } from "./instruments.js";
import { NEO120, NEO_FACETS, NEO_DOMAINS, NEO_DOMAIN_NOTES, ACTION, ACTION_SCALES, WIL, WIL_VALUES } from "./deep.js";
import { scoreIPIP, scoreONET, scoreMood, scoreNEO, scoreAction, scoreWIL, encodeObserver, decodeObserver, observerAnswers } from "./scoring.js";
import { validateCustom, scoreCustom } from "./custom.js";

const KEY = "polaris-compass-v1";
const blank = () => ({ consent: false, ans: {}, observers: [], custom: [] });
let S = load();
const main = document.getElementById("main");

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); return s ? { ...blank(), ...s } : blank(); }
  catch { return blank(); }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* 隐私模式下无法保存，页面照常使用 */ } }
const ans = id => (S.ans[id] ||= {});
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v; else if (k.startsWith("on")) e[k] = v; else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : String(k));
  return e;
};
const html = s => { const t = document.createElement("template"); t.innerHTML = s; return t.content; };

// ---------- 模块注册 ----------
const NEO_DEF = { id: "neo120", name: "大五人格 · 深度版", min: 1, max: 5, labels: IPIP50.labels,
  source: "IPIP-NEO-120（Johnson, 2014；International Personality Item Pool）", license: "公有领域，可以用于任何目的",
  intro: "共 116 题，测 5 个维度、29 个分面，比快速版细得多。请按你平时一贯的样子作答。（原量表 120 题，去掉了 4 道美国政治倾向题。）" };
const ACTION_DEF = { id: "action", name: "行动与创业特质", min: 1, max: 5, labels: IPIP50.labels,
  source: "IPIP 中对应 TCI、VIA、JPI-R 的五个量表：行动启动、坚持、冒险、创新、好奇心", license: "公有领域，可以用于任何目的",
  intro: "这一部分看你「把事情做起来」的方式：能不能马上开始，能不能坚持，敢不敢冒险，有没有新点子，对世界有多好奇。" };
const LIKERT = [
  { def: IPIP50, texts: () => IPIP50.items.map(it => it[0]) },
  { def: NEO_DEF, texts: () => NEO120.map(it => it[1]), keys: () => NEO120.map(it => it[0]) },
  { def: ACTION_DEF, texts: () => ACTION.map(it => it[0]) },
  { def: ONET, texts: () => ONET.items },
  { def: MOOD, texts: () => MOOD.items }
];
function modules() {
  const list = [
    { id: "ipip50", name: "大五人格 · 快速版", minutes: IPIP50.minutes, total: 50, kind: "likert", note: "可以邀请朋友评价你" },
    { id: "neo120", name: NEO_DEF.name, minutes: 15, total: NEO120.length, kind: "likert", note: "29 个分面" },
    { id: "action", name: ACTION_DEF.name, minutes: 6, total: ACTION.length, kind: "likert" },
    { id: "onet", name: ONET.name, minutes: ONET.minutes, total: 60, kind: "likert" },
    { id: "wil", name: "工作价值", minutes: 5, total: WIL.length, kind: "cards" },
    { id: "interview", name: INTERVIEW.name, minutes: INTERVIEW.minutes, total: INTERVIEW.groups.reduce((n, g) => n + g[1].length, 0), kind: "open" },
    { id: "mood", name: MOOD.name, minutes: MOOD.minutes, total: 16, kind: "likert", optional: true }
  ];
  for (const c of S.custom) list.push({ id: "c:" + c.id, name: c.name + "（自行导入）", minutes: Math.ceil(c.items.length / 8), total: c.items.length, kind: "custom" });
  return list;
}
const answered = m => Object.values(ans(m.id)).filter(v => v !== "" && v != null).length;

// ---------- 路由 ----------
let view = "home";
function go(v, arg) {
  view = v;
  document.querySelectorAll(".nav button").forEach(b => b.classList.toggle("on", b.dataset.go === v));
  main.replaceChildren();
  if (!S.consent && v !== "about") return renderConsent();
  ({ home: renderHome, module: renderModule, report: renderReport, observe: renderObserve, about: renderAbout, data: renderData })[v](arg);
  window.scrollTo(0, 0); main.focus({ preventScroll: true });
}
document.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
document.getElementById("home").onclick = () => go("home");

// ---------- 同意页 ----------
function renderConsent() {
  const box = el("input", { type: "checkbox", id: "agree" });
  const btn = el("button", { class: "btn", type: "button", disabled: true, onclick: () => { S.consent = true; save(); go(view === "about" ? "about" : view); } }, "开始");
  box.onchange = () => { btn.disabled = !box.checked; };
  main.append(
    el("h1", {}, "开始之前"),
    el("p", { class: "lead" }, "北极星画像是一个开源的自我了解工具，免费使用。请先读完下面几点。"),
    html(`<div class="prose"><ul>
      <li><b>不是诊断，也不是职业建议。</b>结果只能帮助你更了解自己，不能用来诊断任何心理或精神问题。</li>
      <li><b>不要用于招聘、录取、评级等对别人有重大影响的决定。</b>自评问卷很容易被刻意作答，这类场合不适用。</li>
      <li><b>数据只在你自己的浏览器里。</b>本工具不联网上传任何作答，也没有服务器存储。清除浏览器数据，记录就会消失，建议定期导出备份。</li>
      <li><b>中文题目是本项目翻译或改编的，没有经过中文常模校准。</b>分数适合用来比较你自己各项之间的高低，不适合和别人比。</li>
      <li>如果你正处在强烈的痛苦中，请直接联系身边的人或专业机构（见「声明」页的求助信息），不要依赖本工具。</li>
    </ul></div>`),
    el("label", { class: "check" }, box, el("span", {}, "我已年满 18 周岁，已阅读并同意上述内容和「声明」页的全部条款。")),
    el("div", { class: "btns" }, btn, el("button", { class: "btn ghost", type: "button", onclick: () => renderAboutInline() }, "查看完整声明"))
  );
}
function renderAboutInline() { main.replaceChildren(); renderAbout(true); }

// ---------- 首页 ----------
function renderHome() {
  main.append(
    el("h1", {}, "了解你自己，再决定往哪走"),
    el("p", { class: "lead" }, "基于公开的学术测评工具：大五人格（快速版可以邀请朋友评价你，深度版有 29 个分面）、行动与创业特质、职业兴趣、工作价值，加上一份自我访谈。全部做完大约 70 分钟，可以分几次完成，进度会自动保存在本机。时间不够的话，先做快速版、职业兴趣和工作价值。")
  );
  const cards = el("div", { class: "cards" });
  for (const m of modules()) {
    const n = Math.min(answered(m), m.total);
    cards.append(el("div", { class: "card" },
      el("div", {}, el("b", {}, m.name), el("small", {}, `${m.total} ${m.kind === "cards" ? "张卡片" : "题"} · 约 ${m.minutes} 分钟${m.note ? " · " + m.note : ""}${m.optional ? " · 可选" : ""}`)),
      el("span", { class: "pill" + (n === m.total ? " full" : "") }, `${n}/${m.total}`),
      el("button", { class: "btn" + (n ? " ghost" : ""), type: "button", onclick: () => go("module", m.id) }, n === m.total ? "查看" : n ? "继续" : "开始")
    ));
  }
  main.append(cards,
    el("div", { class: "btns" },
      el("button", { class: "btn", type: "button", onclick: () => go("report") }, "查看我的报告"),
      el("button", { class: "btn ghost", type: "button", onclick: () => go("observe") }, "我来评价朋友"),
      el("button", { class: "btn ghost", type: "button", onclick: () => go("data") }, "导入、导出与备份")));
}

// ---------- 作答页 ----------
function likertBlock(id, def, texts, onChange, keys) {
  const frag = document.createDocumentFragment();
  const lg = el("div", { class: "legend" });
  def.labels.forEach((l, i) => lg.append(el("span", {}, el("b", {}, def.min + i), l)));
  frag.append(lg);
  texts.forEach((t, i) => {
    const k = keys ? keys[i] : i + 1, a = ans(id);
    const it = el("div", { class: "item" + (a[k] != null ? " ok" : "") }, el("div", { class: "q" }, el("span", { class: "no" }, String(i + 1).padStart(2, "0")), el("span", {}, t)));
    const sc = el("div", { class: "scale" });
    for (let v = def.min; v <= def.max; v++) {
      sc.append(el("button", { type: "button", class: a[k] === v ? "sel" : "", title: def.labels[v - def.min], "aria-label": `${k}：${def.labels[v - def.min]}`,
        onclick: e => { a[k] = v; save(); sc.querySelectorAll("button").forEach(x => x.classList.remove("sel")); e.currentTarget.classList.add("sel"); it.classList.add("ok"); onChange?.(k, v); } }, v));
    }
    it.append(sc); frag.append(it);
  });
  return frag;
}
function head(def) {
  return [el("h1", {}, def.name), el("p", { class: "src" }, `来源：${def.source}　条款：${def.license}`), el("p", { class: "lead" }, def.intro)];
}
function renderModule(id) {
  const back = el("div", { class: "btns" }, el("button", { class: "btn", type: "button", onclick: () => go("home") }, "保存并返回"), el("button", { class: "btn ghost", type: "button", onclick: () => go("report") }, "查看报告"));
  if (id === "wil") {
    main.append(el("h1", {}, "工作价值"), el("p", { class: "src" }, "来源：改编自 O*NET Work Importance Locator（USDOL/ETA）　条款：按 O*NET Tools Developer License 改编"),
      el("p", { class: "lead" }, "下面 20 张卡片，每张都以「在我理想的工作中，重要的是……」开头。请按重要程度把它们分到 5 档：5 表示最重要，1 表示最不重要。每一档必须正好放 4 张，所以你需要取舍。"));
    const a = ans("wil"), status = el("div", { class: "note" });
    const upd = () => { const c = [0, 0, 0, 0, 0, 0]; Object.values(a).forEach(v => c[v]++); status.replaceChildren(...[5, 4, 3, 2, 1].map(n => el("span", { style: "margin-right:14px;font-family:var(--f-mono);" + (c[n] > 4 ? "color:var(--warn)" : c[n] === 4 ? "color:var(--done)" : "") }, `第${n}档 ${c[n]}/4`)), el("div", { class: "msg" }, Object.values(c).some(x => x > 4) ? "有一档超过 4 张了，请把多出来的挪到别的档。" : "")); };
    const legend = ["", "最不重要", "不太重要", "一般", "比较重要", "最重要"];
    main.append(status);
    WIL.forEach(([c, t]) => {
      const it = el("div", { class: "item" + (a[c] ? " ok" : "") }, el("div", { class: "q" }, el("span", { class: "no" }, c), el("span", {}, "在我理想的工作中，重要的是：" + t)));
      const sc = el("div", { class: "scale" });
      for (const v of [5, 4, 3, 2, 1]) sc.append(el("button", { type: "button", class: a[c] === v ? "sel" : "", title: legend[v], "aria-label": `${c}：第${v}档，${legend[v]}`,
        onclick: e => { a[c] = v; save(); sc.querySelectorAll("button").forEach(x => x.classList.remove("sel")); e.currentTarget.classList.add("sel"); it.classList.add("ok"); upd(); } }, v));
      it.append(sc); main.append(it);
    });
    upd(); return main.append(back);
  }
  if (id === "interview") {
    main.append(...head(INTERVIEW));
    const a = ans("interview");
    for (const [g, qs] of INTERVIEW.groups) {
      main.append(el("h3", {}, g));
      for (const [k, q] of qs) {
        const ta = el("textarea", { id: "iv-" + k, oninput: e => { a[k] = e.target.value; save(); } }); ta.value = a[k] || "";
        main.append(el("label", { class: "f", for: "iv-" + k }, q), ta);
      }
    }
    return main.append(back);
  }
  if (id.startsWith("c:")) {
    const def = S.custom.find(c => "c:" + c.id === id);
    if (!def) return go("home");
    main.append(...head({ name: def.name, source: def.source || "用户自行导入", license: "由导入者自行负责取得使用权利", intro: def.intro || "" }), likertBlock(id, def, def.items), back);
    return;
  }
  const L = LIKERT.find(x => x.def.id === id);
  main.append(...head(L.def));
  if (id === "mood") {
    const help = el("div", {}); const upd = () => { help.replaceChildren(ans("mood")[9] > 0 ? crisisBox() : ""); };
    main.append(likertBlock(id, L.def, L.texts(), k => { if (k === 9) upd(); }), help); upd();
  } else main.append(likertBlock(id, L.def, L.texts(), null, L.keys?.()));
  main.append(back);
}
function crisisBox() {
  return html(`<div class="note warn"><b>谢谢你如实作答。</b>如果你正被这样的念头困扰，请不要一个人扛：中国大陆可以拨打全国心理援助热线 <b>12356</b>，或北京心理危机研究与干预中心 <b>010-82951332</b>（24 小时）；其他国家和地区可以在 findahelpline.com 查找当地热线。如果有立即的危险，请拨打 <b>120</b> 或 <b>110</b>，或者马上去最近的医院急诊。</div>`);
}

// ---------- 报告 ----------
function barRows(entries, max, min = 1) {
  const box = el("div", { class: "bars" });
  for (const { label, value, other, note } of entries) {
    const pct = v => `${((v - min) / (max - min)) * 100}%`;
    const track = el("div", { class: "track" }, el("span", { class: "mid" }));
    if (value != null) { const i = el("i"); i.style.width = pct(value); track.append(i); }
    if (other != null) { const m = el("span", { class: "mark", title: "朋友评价均值 " + other }); m.style.left = `calc(${pct(other)} - 1px)`; track.append(m); }
    box.append(el("div", { class: "bar-row" }, el("span", { class: "lbl" }, label), track, el("span", { class: "val" }, value ?? "—")));
    if (note) box.append(el("div", { class: "bar-note" }, note));
  }
  return box;
}
function renderReport() {
  main.append(el("h1", {}, "我的报告"), el("p", { class: "lead" }, "下面的分数适合用来看你自己各项之间的相对高低。中文版没有经过常模校准，不要把它当成和别人比较的排名。"));
  // 大五人格
  const ip = scoreIPIP(ans("ipip50"));
  const obs = S.observers.map(p => scoreIPIP(observerAnswers(p)));
  const obsMean = d => obs.length ? Math.round(obs.reduce((s, o) => s + o[d], 0) / obs.length * 100) / 100 : null;
  main.append(el("h2", {}, "大五人格"), el("p", { class: "src" }, IPIP50.source));
  if (Object.values(ip).every(v => v == null)) main.append(el("p", { class: "msg" }, "还没有完成这一部分。"));
  else {
    main.append(barRows(Object.entries(IPIP50.domains).map(([d, n]) => ({ label: n, value: ip[d], other: obsMean(d), note: IPIP50.domainNotes[d] })), 5));
    main.append(el("div", { class: "key" }, el("span", {}, "你的自评"), obs.length ? el("span", { class: "o" }, `${obs.length} 位朋友的评价均值`) : null, el("span", { style: "opacity:.8" }, "中线 = 3 分")));
    if (obs.length) {
      const gaps = Object.entries(IPIP50.domains).map(([d, n]) => [n, ip[d] != null ? Math.round((obsMean(d) - ip[d]) * 100) / 100 : null]).filter(x => x[1] != null).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
      if (gaps.length && Math.abs(gaps[0][1]) >= 0.5) main.append(el("div", { class: "note" }, `你和朋友看法差得最多的是「${gaps[0][0]}」：朋友眼中的你比你的自评${gaps[0][1] > 0 ? "高" : "低"} ${Math.abs(gaps[0][1])} 分。差距在 0.5 分以上就值得想一想，问问他们为什么这样看你。`));
    }
  }
  // 朋友评价
  main.append(el("h3", {}, "朋友的评价"));
  const codeBox = el("textarea", { class: "code", id: "obs-code", placeholder: "把朋友发来的结果码粘贴到这里（以 CMP1: 开头），可以一次粘贴多段" });
  const msg = el("div", { class: "msg" });
  main.append(el("p", { class: "lead" }, "让了解你的人打开本工具的「评价朋友」页，答完后把结果码发给你。至少收集 3 份，结果会更可靠。"), codeBox, msg,
    el("div", { class: "btns" }, el("button", { class: "btn ghost", type: "button", onclick: () => {
      const found = codeBox.value.match(/CMP1:[A-Za-z0-9+/=]+/g) || [];
      let ok = 0, bad = 0;
      for (const c of found) { try { const p = decodeObserver(c); if (!S.observers.some(o => o.a === p.a && o.t === p.t && o.nm === p.nm)) { S.observers.push(p); ok++; } } catch { bad++; } }
      save(); msg.className = "msg" + (bad || !found.length ? " warn" : ""); msg.textContent = found.length ? `添加了 ${ok} 份${bad ? `，有 ${bad} 段结果码无法识别` : ""}。` : "没有找到结果码。";
      if (ok) setTimeout(() => go("report"), 600);
    } }, "添加朋友的评价")));
  if (S.observers.length) {
    const t = el("table", {}, el("tr", {}, el("th", {}, "评价人"), el("th", {}, "关系"), el("th", {}, "TA 说你最擅长"), el("th", {}, "TA 说你最该改"), el("th", {})));
    S.observers.forEach((p, i) => t.append(el("tr", {}, el("td", {}, p.nm || "匿名"), el("td", {}, p.rel || ""), el("td", {}, p.o?.[0] || ""), el("td", {}, p.o?.[1] || ""),
      el("td", {}, el("button", { class: "btn ghost", type: "button", onclick: () => { S.observers.splice(i, 1); save(); go("report"); } }, "删除")))));
    main.append(el("div", { class: "tbl" }, t));
  }
  // 深度版
  const neo = scoreNEO(ans("neo120"));
  if (Object.values(neo.facets).some(v => v != null)) {
    main.append(el("h2", {}, "大五人格 · 深度版"), el("p", { class: "src" }, NEO_DEF.source));
    if (Object.values(neo.domains).some(v => v != null)) main.append(barRows(Object.entries(NEO_DOMAINS).map(([d, n]) => ({ label: n.replace(/（.*）/, ""), value: neo.domains[d], note: NEO_DOMAIN_NOTES[d] })), 5));
    for (const [d, n] of Object.entries(NEO_DOMAINS)) {
      const rows = Object.entries(NEO_FACETS).filter(([k]) => k[0] === d).map(([k, fn]) => ({ label: fn, value: neo.facets[k] }));
      if (rows.some(r => r.value != null)) main.append(el("h3", {}, n), barRows(rows, 5));
    }
    const fs = Object.entries(neo.facets).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
    if (fs.length >= 10) main.append(el("div", { class: "note" }, `你最突出的分面：${fs.slice(0, 3).map(([k, v]) => NEO_FACETS[k] + " " + v).join("、")}；最低的分面：${fs.slice(-3).reverse().map(([k, v]) => NEO_FACETS[k] + " " + v).join("、")}。注意「神经质」下面的分面，分数越高表示越容易出现这种情绪。`));
  }
  const act = scoreAction(ans("action"));
  if (Object.values(act).some(v => v != null)) {
    main.append(el("h2", {}, "行动与创业特质"), el("p", { class: "src" }, ACTION_DEF.source),
      barRows(Object.entries(ACTION_SCALES).map(([k, [n, , note]]) => ({ label: n, value: act[k], note })), 5));
    if (act.init != null && act.init < 3 && act.pers != null && act.pers >= 3) main.append(el("div", { class: "note" }, "你的「坚持」不低，但「行动启动」偏低：一旦开始就能做下去，难的是开始那一下。给自己设定外部截止日期、把第一步拆得足够小，往往比逼自己坚持更有效。"));
  }
  // 职业兴趣
  const on = scoreONET(ans("onet"));
  main.append(el("h2", {}, "职业兴趣"), el("p", { class: "src" }, ONET.source));
  if (!on.code) main.append(el("p", { class: "msg" }, "还没有完成这一部分。"));
  else {
    main.append(barRows([...ONET.order].map(t => ({ label: `${t} ${ONET.types[t][0]}`, value: on.scores[t], note: ONET.types[t][1] })), 50, 10));
    main.append(el("div", { class: "note" }, `你的兴趣代码：${on.code}。${on.spread < 10 ? "你各类兴趣的分数很接近（最高和最低只差 " + on.spread + " 分），说明兴趣分化程度比较低。这类人往往觉得什么都能做，但选方向时容易犹豫，可以结合下面的自我访谈，看看实际让你投入的是哪类事。" : "最高的三类就是你最可能感到投入的工作类型。"}`));
  }
  // 工作价值
  const wil = scoreWIL(ans("wil"));
  main.append(el("h2", {}, "工作价值"), el("p", { class: "src" }, "改编自 O*NET Work Importance Locator"));
  if (!wil.ok) main.append(el("p", { class: "msg" }, "还没有完成，或者有的档不是正好 4 张卡片。"));
  else {
    main.append(barRows(wil.ranked.map(([k, v]) => ({ label: WIL_VALUES[k][0], value: v, note: WIL_VALUES[k][2] })), 30, 6));
    main.append(el("p", { class: "lead" }, `排在前两位的「${WIL_VALUES[wil.ranked[0][0]][0]}」和「${WIL_VALUES[wil.ranked[1][0]][0]}」，是你选择工作或生意时最不该牺牲的东西。分数范围是 6 到 30 分。`));
  }
  // 自定义题库
  for (const c of S.custom) {
    const r = scoreCustom(c, ans("c:" + c.id));
    main.append(el("h2", {}, c.name + "（自行导入）"), el("p", { class: "src" }, c.source || ""));
    if (!r) main.append(el("p", { class: "msg" }, "还没有完成这一部分。"));
    else main.append(barRows(Object.entries(r).map(([k, v]) => ({ label: k, value: v })), c.max, c.min));
  }
  // 情绪状态
  const md = scoreMood(ans("mood"));
  if (md.phq != null || md.gad != null) {
    main.append(el("h2", {}, "最近两周的情绪状态"), el("p", { class: "src" }, MOOD.source));
    if (md.phq != null) main.append(el("p", {}, `PHQ-9（抑郁相关症状）：${md.phq} 分，属于「${md.phqBand}」范围。`));
    if (md.gad != null) main.append(el("p", {}, `GAD-7（焦虑相关症状）：${md.gad} 分，属于「${md.gadBand}」范围。`));
    main.append(el("p", { class: "lead" }, "这是筛查，不是诊断。如果分数在 10 分以上，或者这种状态已经持续了两周以上，建议去医院的精神心理科或心理门诊看看，这和身体不舒服去看医生一样正常。"));
    if (md.item9 > 0) main.append(crisisBox());
  }
  // 自我访谈
  const iv = ans("interview");
  if (Object.values(iv).some(Boolean)) main.append(el("h2", {}, "自我访谈"), el("p", { class: "lead" }, "你写下的内容已经保存在本机。可以到「导入、导出与备份」页导出成文本，拿给信任的人看，或者以后对照着重读。"));
  main.append(el("div", { class: "btns" }, el("button", { class: "btn ghost", type: "button", onclick: () => go("data") }, "导出我的结果")));
}

// ---------- 评价朋友 ----------
function renderObserve() {
  const a = {};
  main.append(el("h1", {}, "评价一位朋友"),
    el("p", { class: "lead" }, "你的朋友想知道别人眼中的 TA 是什么样的。请按你对 TA 平时的真实印象作答，直率的评价最有用。大约 6 分钟。"),
    el("div", { class: "note" }, "你的作答不会上传。答完后，页面会生成一段结果码，复制后发给你的朋友就行。结果码里不包含你的任何联系方式。"));
  const rel = el("select", { id: "ob-rel" }, ...["", "同事", "上级", "朋友", "同学", "家人", "伴侣", "其他"].map(x => el("option", { value: x }, x || "请选择")));
  const nm = el("input", { type: "text", id: "ob-nm", maxlength: 20, autocomplete: "off" });
  main.append(el("label", { class: "f", for: "ob-rel" }, "你和 TA 的关系"), rel, el("label", { class: "f", for: "ob-nm" }, "你的称呼（选填，方便 TA 知道是谁）"), nm,
    el("h2", {}, "TA 是一个怎样的人"), el("p", { class: "lead" }, IPIP50.observerIntro));
  const frag = document.createDocumentFragment();
  const lg = el("div", { class: "legend" }); IPIP50.labels.forEach((l, i) => lg.append(el("span", {}, el("b", {}, i + 1), l))); frag.append(lg);
  IPIP50.items.forEach((itm, i) => {
    const k = i + 1, it = el("div", { class: "item" }, el("div", { class: "q" }, el("span", { class: "no" }, String(k).padStart(2, "0")), el("span", {}, itm[1])));
    const sc = el("div", { class: "scale" });
    for (let v = 1; v <= 5; v++) sc.append(el("button", { type: "button", "aria-label": `${k}：${IPIP50.labels[v - 1]}`, title: IPIP50.labels[v - 1],
      onclick: e => { a[k] = v; sc.querySelectorAll("button").forEach(x => x.classList.remove("sel")); e.currentTarget.classList.add("sel"); it.classList.add("ok"); } }, v));
    it.append(sc); frag.append(it);
  });
  const o1 = el("textarea", { id: "ob-o1" }), o2 = el("textarea", { id: "ob-o2" });
  const out = el("textarea", { class: "code", readonly: true, hidden: true, "aria-label": "结果码" }), msg = el("div", { class: "msg" });
  const copy = el("button", { class: "btn ghost", type: "button", hidden: true, onclick: async () => {
    try { await navigator.clipboard.writeText(out.value); msg.textContent = "已复制，发给你的朋友就可以了。谢谢！"; }
    catch { out.focus(); out.select(); msg.textContent = "自动复制没有成功，结果码已经选中，请长按或按 Ctrl+C 复制。"; }
  } }, "复制结果码");
  main.append(frag, el("h2", {}, "两句话就好"),
    el("label", { class: "f", for: "ob-o1" }, "你觉得 TA 最擅长什么？"), o1,
    el("label", { class: "f", for: "ob-o2" }, "你觉得 TA 最该改的一点是什么？"), o2,
    el("div", { class: "btns" }, el("button", { class: "btn", type: "button", onclick: () => {
      const miss = IPIP50.items.map((_, i) => i + 1).filter(k => !a[k]);
      if (!rel.value) { msg.className = "msg warn"; msg.textContent = "请先选择你和 TA 的关系。"; return; }
      if (miss.length) { msg.className = "msg warn"; msg.textContent = `还有 ${miss.length} 题没答：${miss.slice(0, 12).join("、")}${miss.length > 12 ? "……" : ""}`; return; }
      out.value = encodeObserver({ rel: rel.value, nm: nm.value.trim(), a: IPIP50.items.map((_, i) => a[i + 1]).join(""), o: [o1.value.trim(), o2.value.trim()], t: new Date().toISOString().slice(0, 10) });
      out.hidden = false; copy.hidden = false; msg.className = "msg"; msg.textContent = "把这段结果码完整复制，发给你的朋友。";
    } }, "生成结果码"), copy), out, msg);
}

// ---------- 导入、导出与备份 ----------
function download(name, text, type) {
  const a = el("a", { href: URL.createObjectURL(new Blob([text], { type })), download: name }); document.body.append(a); a.click(); a.remove();
}
function interviewText() {
  const a = ans("interview"); let s = "# 北极星画像 · 自我访谈\n\n";
  for (const [g, qs] of INTERVIEW.groups) { s += `## ${g}\n\n`; for (const [k, q] of qs) s += `**${q}**\n\n${(a[k] || "（未作答）").trim()}\n\n`; }
  return s;
}
function renderData() {
  const msg = el("div", { class: "msg" });
  const fileIn = (accept, onload) => { const f = el("input", { type: "file", accept, hidden: true, onchange: e => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = () => onload(String(r.result)); r.readAsText(file); } }); document.body.append(f); f.click(); setTimeout(() => f.remove(), 60000); };
  main.append(el("h1", {}, "导入、导出与备份"),
    el("p", { class: "lead" }, "你的作答只保存在这个浏览器里。换电脑、清除浏览器数据之前，请先导出备份。"),
    el("h2", {}, "备份"),
    el("div", { class: "btns" },
      el("button", { class: "btn", type: "button", onclick: () => download("北极星画像-备份.json", JSON.stringify(S, null, 1), "application/json") }, "导出全部数据（JSON）"),
      el("button", { class: "btn ghost", type: "button", onclick: () => download("北极星画像-自我访谈.md", interviewText(), "text/markdown") }, "导出自我访谈（文本）"),
      el("button", { class: "btn ghost", type: "button", onclick: () => fileIn(".json,application/json", t => {
        try { const s = JSON.parse(t); if (!s || typeof s.ans !== "object") throw 0; S = { ...blank(), ...s, consent: true }; save(); msg.className = "msg"; msg.textContent = "已恢复备份。"; }
        catch { msg.className = "msg warn"; msg.textContent = "这个文件不是有效的备份。"; }
      }) }, "从备份恢复")),
    el("h2", {}, "导入你自己的题库"),
    html(`<div class="prose"><p>本工具只内置可以公开发布的题目。如果你<b>已经通过合法途径取得了</b>某个量表（例如从原作者的官网下载），可以按 <code>docs/题库格式.md</code> 的格式整理成 JSON 文件，在这里导入。题库文件只保存在你自己的浏览器里，不会上传，也不会出现在本项目中。</p>
    <p><b>导入即表示你确认：</b>你有权在个人范围内使用这些题目，并自行遵守原作者的使用条款；本项目不提供、不审核、也不分发任何导入的内容。请不要把含有受版权保护题目的题库文件公开传播。</p></div>`),
    el("div", { class: "btns" }, el("button", { class: "btn ghost", type: "button", onclick: () => fileIn(".json,application/json", t => {
      try { const c = validateCustom(JSON.parse(t)); S.custom = S.custom.filter(x => x.id !== c.id).concat(c); save(); msg.className = "msg"; msg.textContent = `已导入「${c.name}」，共 ${c.items.length} 题。回到首页就能看到。`; }
      catch (e) { msg.className = "msg warn"; msg.textContent = "导入失败：" + (e.message || "文件格式不对"); }
    }) }, "导入题库文件")),
    S.custom.length ? el("ul", {}, ...S.custom.map(c => el("li", {}, c.name + " ", el("button", { class: "btn ghost", type: "button", onclick: () => { S.custom = S.custom.filter(x => x.id !== c.id); delete S.ans["c:" + c.id]; save(); go("data"); } }, "移除")))) : null,
    el("h2", {}, "清除"),
    el("div", { class: "btns" }, el("button", { class: "btn ghost", type: "button", onclick: e => {
      if (e.currentTarget.dataset.armed) { S = blank(); save(); try { localStorage.removeItem(KEY); } catch {} go("home"); return; }
      e.currentTarget.dataset.armed = "1"; e.currentTarget.textContent = "再点一次，确认清除全部数据（无法恢复）";
    } }, "清除本机的全部数据")),
    msg);
}

// ---------- 声明 ----------
function renderAbout(fromConsent) {
  main.append(el("h1", {}, "声明"), html(ABOUT));
  const t = el("table", {}, el("tr", {}, el("th", {}, "量表"), el("th", {}, "作者"), el("th", {}, "状态"), el("th", {}, "本工具里的替代")));
  PENDING.forEach(([n, a, st, alt]) => t.append(el("tr", {}, el("td", {}, n), el("td", {}, a), el("td", {}, st), el("td", {}, alt))));
  main.append(el("h2", {}, "未收录的量表"), el("p", { class: "lead" }, "下面这些量表质量很好，但原作者没有允许公开分发，所以本项目不收录，而是用公有领域的同类量表替代。我们也在联系作者申请授权。"), el("div", { class: "tbl" }, t));
  if (fromConsent === true) main.append(el("div", { class: "btns" }, el("button", { class: "btn", type: "button", onclick: () => go("home") }, "返回")));
}
const ABOUT = `<div class="prose">
<h2>这是什么</h2>
<p>北极星画像是一个开源、免费的自我了解工具，由 PolarisAGI 发起。代码按 MIT 许可发布，任何人都可以查看、使用和修改。</p>
<h2>不是什么</h2>
<ul>
<li>不是心理诊断，也不能代替心理咨询或治疗。</li>
<li>不是职业建议、投资建议或法律建议。</li>
<li>不适用于招聘、录取、晋升、评级等对他人有重大影响的决定。</li>
<li>不适用于未满 18 周岁的人。</li>
</ul>
<h2>数据与隐私</h2>
<ul>
<li>所有作答、报告和导入的题库都只保存在你自己浏览器的本地存储里。本工具不向任何服务器发送作答数据，没有账号系统，也不使用统计或追踪脚本。</li>
<li>页面会从 Google Fonts 加载字体，这个请求不包含你的任何作答。</li>
<li>他评结果码由评价人自己复制、自己发送，本项目不经手。结果码里只有作答、关系和评价人自己填写的称呼。</li>
<li>清除浏览器数据后，记录无法找回。请自行导出备份。</li>
</ul>
<h2>题目来源与条款</h2>
<ul>
<li><b>大五人格 · 快速版：</b>IPIP Big-Five Factor Markers（Goldberg, 1992）。<b>深度版：</b>IPIP-NEO-120（Johnson, 2014），去掉了 4 道美国政治倾向题。<b>行动与创业特质：</b>IPIP 中对应 TCI（行动启动）、VIA（坚持、创新、好奇心）、JPI-R（冒险）的量表。以上均来自 International Personality Item Pool（ipip.ori.org），属于公有领域，中文为本项目翻译。</li>
<li><b>职业兴趣：</b>改编自 O*NET Interest Profiler Short Form。本项目依据 O*NET Tools Developer License 进行了中文翻译和本地化改写。来源：O*NET Career Exploration Tools，美国劳工部就业与培训管理局（USDOL/ETA）。USDOL/ETA 没有审核、批准或认可这些改动。O*NET 是 USDOL/ETA 的商标。</li>
<li><b>工作价值：</b>改编自 O*NET Work Importance Locator（20 张卡片、6 类工作价值，计分规则沿用原版），依据 O*NET Tools Developer License 翻译和改编。</li>
<li><b>情绪状态：</b>PHQ-9 和 GAD-7，由 Spitzer、Williams、Kroenke 等编制。原作者声明，复制、翻译、展示和分发无需许可。</li>
<li><b>自我访谈：</b>参考 McAdams 人生故事访谈与 Savickas 生涯建构访谈的思路，题目原创。</li>
<li>所有中文翻译都没有经过正式的回译和常模研究，结果仅供参考。</li>
</ul>
<h2>用户自行导入的题库</h2>
<p>本工具允许用户在自己的浏览器里导入题库文件。导入的内容完全由用户自己提供、自己负责，本项目不提供、不托管、不审核、也不分发这些内容。请只导入你有权使用的题目，并遵守原作者的条款。</p>
<h2>求助信息</h2>
<p>如果你正处在强烈的痛苦中，或者有伤害自己的念头：中国大陆可以拨打全国心理援助热线 <b>12356</b>，或北京心理危机研究与干预中心 <b>010-82951332</b>（24 小时）；其他国家和地区可以在 findahelpline.com 查找当地热线。如果有立即的危险，请拨打 <b>120</b> 或 <b>110</b>，或者马上去最近的医院急诊。</p>
<h2>免责</h2>
<p>本工具按「现状」提供，不对结果的准确性、适用性作任何保证。使用本工具以及依据结果做出的任何决定，由使用者自己负责。如果你是某个量表的权利人，认为本项目的使用有不当之处，请在项目仓库提交 issue，我们会及时处理。</p>
</div>`;

go("home");
