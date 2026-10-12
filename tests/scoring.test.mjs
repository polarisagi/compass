import { test } from "node:test";
import assert from "node:assert/strict";
import { IPIP50 } from "../js/instruments.js";
import { NEO120, ACTION, WIL } from "../js/deep.js";
import { scoreIPIP, scoreONET, scoreMood, scoreNEO, scoreAction, scoreWIL, encodeObserver, decodeObserver, observerAnswers } from "../js/scoring.js";
import { validateCustom, scoreCustom } from "../js/custom.js";

const fill = (n, v) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, typeof v === "function" ? v(i + 1) : v]));

test("IPIP：全选 3 时每个维度都是 3", () => {
  assert.deepEqual(scoreIPIP(fill(50, 3)), { E: 3, A: 3, C: 3, N: 3, O: 3 });
});
test("IPIP：正向题选 5、反向题选 1，每个维度都是 5", () => {
  const a = fill(50, i => IPIP50.items[i - 1][3] > 0 ? 5 : 1);
  assert.deepEqual(scoreIPIP(a), { E: 5, A: 5, C: 5, N: 5, O: 5 });
});
test("IPIP：没答完的维度返回 null", () => {
  const a = fill(50, 4); delete a[1];
  assert.equal(scoreIPIP(a).E, null);
  assert.notEqual(scoreIPIP(a).A, null);
});

test("O*NET：每类 10 题，兴趣代码取前三", () => {
  // 第 i 题属于 RIASEC 的第 (i-1)%6 类；让 E 最高、R 次之、I 第三
  const pref = { R: 4, I: 3, A: 1, S: 2, E: 5, C: 1 };
  const r = scoreONET(fill(60, i => pref["RIASEC"[(i - 1) % 6]]));
  assert.equal(r.code, "ERI");
  assert.equal(r.scores.E, 50);
  assert.equal(r.spread, 40);
});
test("O*NET：没答完时没有代码", () => {
  const a = fill(60, 3); delete a[60];
  assert.equal(scoreONET(a).code, null);
});

test("情绪：PHQ-9 和 GAD-7 分段", () => {
  const r = scoreMood(fill(16, i => i <= 9 ? 1 : 2));
  assert.equal(r.phq, 9); assert.equal(r.phqBand, "轻度");
  assert.equal(r.gad, 14); assert.equal(r.gadBand, "中度");
});

test("深度版：116 题全部选 3，29 个分面和 5 个维度都是 3", () => {
  const a = Object.fromEntries(NEO120.map(([n]) => [n, 3]));
  const r = scoreNEO(a);
  assert.equal(Object.keys(r.facets).length, 29);
  assert.ok(Object.values(r.facets).every(v => v === 3));
  assert.ok(Object.values(r.domains).every(v => v === 3));
});
test("深度版：每个分面正好 4 题", () => {
  const c = {}; for (const [, , f] of NEO120) c[f] = (c[f] || 0) + 1;
  assert.ok(Object.values(c).every(n => n === 4));
});

test("行动特质：反向计分", () => {
  const a = fill(ACTION.length, i => ACTION[i - 1][2] > 0 ? 5 : 1);
  assert.ok(Object.values(scoreAction(a)).every(v => v === 5));
});

test("工作价值：每档 4 张才算完成，成就感权重为 3", () => {
  const cols = {}; WIL.forEach(([c], i) => { cols[c] = 5 - Math.floor(i / 4); });
  const r = scoreWIL(cols);
  assert.equal(r.ok, true);
  assert.equal(r.scores.ACH, (5 + 4) * 3); // A 在第 5 档，F 在第 4 档
  cols.A = 1;
  assert.equal(scoreWIL(cols).ok, false);
});

test("他评结果码：编码、解码往返一致，支持中文", () => {
  const p = { rel: "同事", nm: "小王", a: "12345".repeat(10), o: ["写代码快", "不爱沟通"], t: "2026-10-12" };
  const d = decodeObserver("随便一段话 " + encodeObserver(p) + " 谢谢");
  assert.equal(d.nm, "小王"); assert.deepEqual(d.o, p.o);
  assert.equal(observerAnswers(d)[5], 5);
  assert.throws(() => decodeObserver("CMP1:abc"));
});

test("自行导入题库：校验、清洗和反向计分", () => {
  const q = validateCustom({ format: "polaris-compass/questionnaire@1", id: "t1", name: "<b>测试</b>", min: 1, max: 5,
    labels: ["1", "2", "3", "4", "5"], items: ["a", "b"], scales: { 甲: [1, -2] }, extra: "丢掉" });
  assert.equal(q.name, "b测试/b");
  assert.equal(q.extra, undefined);
  assert.deepEqual(scoreCustom(q, { 1: 5, 2: 1 }), { 甲: 5 });
  assert.equal(scoreCustom(q, { 1: 5 }), null);
  assert.throws(() => validateCustom({ ...q, scales: { 甲: [3] } }));
});
