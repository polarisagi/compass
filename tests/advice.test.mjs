import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAdvice } from "../js/advice.js";
import { computeResults, reportMarkdown, radarGeometry } from "../js/report.js";
import { IPIP50 } from "../js/instruments.js";
import { WIL, ACTION } from "../js/deep.js";
import { encodeObserver, decodeObserver } from "../js/scoring.js";

const empty = { facets: {}, domains: {} };
const onet = (code, scores, spread = 20) => ({ code, scores, spread });

test("什么都没做：提示邀请朋友和补齐模块，最多三条", () => {
  const a = buildAdvice({});
  assert.equal(a.length, 3);
  assert.deepEqual(a.map(x => x.id), ["invite", "onet", "wil"]);
  for (const x of a) assert.ok(x.title && x.body && x.basis);
});

test("自评和他评差距大时，排在第一位", () => {
  const ipip = { E: 2, A: 3, C: 3, N: 3, O: 3 }, obs = { E: 3.4, A: 3, C: 3, N: 3, O: 3 };
  const a = buildAdvice({ ipip, obs, obsCount: 3, neo: empty });
  assert.equal(a[0].id, "gap");
  assert.match(a[0].title, /外向性/);
  assert.match(a[0].body, /高 1\.4 分/);
});

test("看重独立但不爱冒险：建议先做副业", () => {
  const wil = { ok: true, ranked: [["IND", 30], ["ACH", 27]] };
  const a = buildAdvice({ wil, act: { risk: 2.2, init: 3.5, pers: 3.5 }, neo: empty });
  assert.equal(a[0].id, "side");
});

test("看重稳定：建议稳妥的转型路径，不建议直接单干", () => {
  const wil = { ok: true, ranked: [["WC", 30], ["SUP", 24]] };
  const a = buildAdvice({ wil, neo: empty });
  assert.ok(a.some(x => x.id === "inside"));
  assert.ok(!a.some(x => x.id === "side"));
});

test("企业型兴趣高但内向：一对多", () => {
  const a = buildAdvice({ ipip: { E: 2.2, A: 3, C: 3, N: 3, O: 3 }, onet: onet("EIC", { E: 45, I: 40, C: 35, R: 20, A: 15, S: 12 }), neo: empty });
  assert.ok(a.some(x => x.id === "media"));
});

test("行动启动低、坚持高：缩小第一步", () => {
  const a = buildAdvice({ act: { init: 2.4, pers: 3.6 }, neo: empty });
  assert.equal(a[0].id, "start");
});

test("同一条建议不会重复出现", () => {
  const a = buildAdvice({ act: { init: 2.4, pers: 3.6 }, neo: { facets: { C5: 2 }, domains: {} } });
  assert.equal(new Set(a.map(x => x.id)).size, a.length);
});

test("报告：完整数据可以生成 Markdown，默认不含情绪部分", () => {
  const ipip = Object.fromEntries(IPIP50.items.map((it, i) => [i + 1, it[3] > 0 ? 4 : 2]));
  const wil = {}; WIL.forEach(([c], i) => { wil[c] = 5 - Math.floor(i / 4); });
  const action = Object.fromEntries(ACTION.map((_, i) => [i + 1, 3]));
  const onetAns = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [i + 1, (i % 6) + 1 > 5 ? 5 : (i % 6) + 1]));
  const friend = decodeObserver(encodeObserver({ rel: "同事", nm: "小王", a: "3".repeat(50), o: ["靠谱", "话少"], t: "2026-10-12" }));
  const S = { ans: { ipip50: ipip, wil, action, onet: onetAns, mood: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 1, 1])), interview: { hobby: "写代码" } },
    observers: [friend], custom: [] };
  const r = computeResults(S);
  assert.equal(r.obsCount, 1);
  assert.equal(r.obs.E, 3);
  assert.ok(r.advice.length >= 1 && r.advice.length <= 3);
  const md = reportMarkdown(S, { date: "2026-10-12" });
  for (const h of ["## 三条建议", "## 大五人格", "### 朋友的评价", "## 行动与创业特质", "## 职业兴趣", "## 工作价值", "## 自我访谈"]) assert.ok(md.includes(h), h);
  assert.ok(md.includes("小王"));
  assert.ok(!md.includes("PHQ-9"));
  assert.ok(reportMarkdown(S, { includeMood: true }).includes("PHQ-9"));
});

test("雷达图：分数在 1 到 5 之间映射到半径", () => {
  const g = radarGeometry([5, 1, 3, 3, 3]);
  assert.deepEqual(g.poly[0], [150, 46]); // 5 分在最上方的轴端
  assert.deepEqual(g.poly[1], [150, 150]); // 1 分在圆心
  assert.equal(radarGeometry([3, null, 3, 3, 3]).poly, null);
});
