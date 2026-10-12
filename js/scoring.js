// 计分：纯函数，不依赖页面，可以在 Node 里测试。
import { IPIP50, ONET } from "./instruments.js";
import { NEO120, NEO_FACETS, NEO_DOMAINS, ACTION, ACTION_SCALES, WIL, WIL_VALUES } from "./deep.js";

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const r2 = x => Math.round(x * 100) / 100;

// answers: {1: 4, 2: 3, ...}（题号从 1 开始）
export function scoreIPIP(answers) {
  const by = {};
  IPIP50.items.forEach(([, , d, key], i) => {
    const v = answers[i + 1];
    if (v == null) return;
    (by[d] ||= []).push(key > 0 ? v : 6 - v);
  });
  const out = {};
  for (const d of Object.keys(IPIP50.domains)) out[d] = by[d]?.length === 10 ? r2(mean(by[d])) : null;
  return out;
}

export function scoreONET(answers) {
  const s = {};
  [...ONET.order].forEach((t, j) => {
    let sum = 0, n = 0;
    for (let i = j; i < 60; i += 6) { const v = answers[i + 1]; if (v != null) { sum += v; n++; } }
    s[t] = n === 10 ? sum : null;
  });
  const complete = Object.values(s).every(v => v != null);
  const ranked = complete ? Object.entries(s).sort((a, b) => b[1] - a[1]) : [];
  return {
    scores: s,
    code: complete ? ranked.slice(0, 3).map(x => x[0]).join("") : null,
    // 分化度：最高分减最低分（满分区间 10–50）
    spread: complete ? ranked[0][1] - ranked[5][1] : null
  };
}

export function scoreMood(answers) {
  const sum = (from, to) => { let s = 0; for (let i = from; i <= to; i++) { if (answers[i] == null) return null; s += answers[i]; } return s; };
  const phq = sum(1, 9), gad = sum(10, 16);
  const phqBand = phq == null ? null : phq <= 4 ? "很轻或没有" : phq <= 9 ? "轻度" : phq <= 14 ? "中度" : phq <= 19 ? "中重度" : "重度";
  const gadBand = gad == null ? null : gad <= 4 ? "很轻或没有" : gad <= 9 ? "轻度" : gad <= 14 ? "中度" : "重度";
  return { phq, gad, phqBand, gadBand, item9: answers[9] ?? null };
}

// 他评结果码：CMP1: + base64(JSON)，只含作答，不含任何联系方式
export function encodeObserver(payload) {
  const json = JSON.stringify({ v: 1, ...payload });
  return "CMP1:" + btoa(unescape(encodeURIComponent(json)));
}
export function decodeObserver(code) {
  const m = String(code).trim().match(/CMP1:([A-Za-z0-9+/=]+)/);
  if (!m) throw new Error("不是有效的他评结果码");
  let p;
  try { p = JSON.parse(decodeURIComponent(escape(atob(m[1])))); }
  catch { throw new Error("结果码不完整，可能复制时漏掉了一部分"); }
  if (p.v !== 1 || typeof p.a !== "string" || !/^[1-5]{50}$/.test(p.a)) throw new Error("结果码内容不完整");
  return p;
}
export function observerAnswers(p) {
  const a = {}; [...p.a].forEach((c, i) => { a[i + 1] = Number(c); }); return a;
}

// ---------- 深度版 ----------

// answers 以原题号为键（NEO120 的第 1 个元素）
export function scoreNEO(answers) {
  const f = {};
  for (const [n, , facet, key] of NEO120) {
    const v = answers[n]; if (v == null) continue;
    (f[facet] ||= []).push(key > 0 ? v : 6 - v);
  }
  const facets = {};
  for (const k of Object.keys(NEO_FACETS)) facets[k] = f[k]?.length === 4 ? r2(mean(f[k])) : null;
  const domains = {};
  for (const d of Object.keys(NEO_DOMAINS)) {
    const fs = Object.keys(NEO_FACETS).filter(k => k[0] === d).map(k => facets[k]);
    domains[d] = fs.every(v => v != null) ? r2(mean(fs)) : null;
  }
  return { facets, domains };
}

// answers 以题目序号（从 1 开始）为键
export function scoreAction(answers) {
  const s = {};
  ACTION.forEach(([, k, key], i) => { const v = answers[i + 1]; if (v == null) return; (s[k] ||= []).push(key > 0 ? v : 6 - v); });
  const out = {};
  for (const k of Object.keys(ACTION_SCALES)) {
    const n = ACTION.filter(x => x[1] === k).length;
    out[k] = s[k]?.length === n ? r2(mean(s[k])) : null;
  }
  return out;
}

// cols：{卡片字母: 列号 1–5}；必须每列正好 4 张
export function scoreWIL(cols) {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const [c] of WIL) { const v = cols[c]; if (!(v >= 1 && v <= 5)) return { ok: false, counts }; counts[v]++; }
  if (counts.slice(1).some(n => n !== 4)) return { ok: false, counts };
  const sum = {};
  for (const [c, , val] of WIL) sum[val] = (sum[val] || 0) + cols[c];
  const scores = Object.fromEntries(Object.entries(WIL_VALUES).map(([k, [, mult]]) => [k, sum[k] * mult]));
  return { ok: true, counts, scores, ranked: Object.entries(scores).sort((a, b) => b[1] - a[1]) };
}
