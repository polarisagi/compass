// 报告的数据汇总和 Markdown 导出：纯函数，不依赖页面，可以在 Node 里测试。
import { IPIP50, ONET, INTERVIEW } from "./instruments.js";
import { NEO_FACETS, NEO_DOMAINS, ACTION_SCALES, WIL_VALUES } from "./deep.js";
import { scoreIPIP, scoreONET, scoreMood, scoreNEO, scoreAction, scoreWIL, observerAnswers } from "./scoring.js";
import { scoreCustom } from "./custom.js";
import { buildAdvice } from "./advice.js";
import { SITE } from "./config.js";

const r2 = x => Math.round(x * 100) / 100;

// S：页面保存在 localStorage 里的整个状态 { ans, observers, custom }
export function computeResults(S) {
  const A = id => S.ans?.[id] || {};
  const ipip = scoreIPIP(A("ipip50"));
  const observers = (S.observers || []).map(p => ({ p, s: scoreIPIP(observerAnswers(p)) }));
  let obs = null;
  if (observers.length) {
    obs = {};
    for (const d of Object.keys(IPIP50.domains)) obs[d] = r2(observers.reduce((t, o) => t + o.s[d], 0) / observers.length);
  }
  const r = {
    ipip, obs, obsCount: observers.length, observers,
    neo: scoreNEO(A("neo120")), act: scoreAction(A("action")), onet: scoreONET(A("onet")), wil: scoreWIL(A("wil")),
    mood: scoreMood(A("mood")),
    custom: (S.custom || []).map(c => ({ c, s: scoreCustom(c, A("c:" + c.id)) })),
    interview: A("interview")
  };
  r.advice = buildAdvice(r);
  return r;
}

const line = (label, v, max) => `| ${label} | ${v ?? "—"}${v != null && max ? ` / ${max}` : ""} |`;

export function reportMarkdown(S, { date = new Date().toISOString().slice(0, 10), includeMood = false, includeInterview = true } = {}) {
  const r = computeResults(S);
  const out = [`# 北极星画像 · 我的报告`, ``, `生成日期：${date}　｜　${SITE.url}`, ``,
    `> 分数适合用来看你自己各项之间的相对高低。中文版没有经过常模校准，不要当成和别人比较的排名。本报告不是心理诊断，也不是职业建议。`, ``];

  out.push(`## 三条建议`, ``);
  r.advice.forEach((a, i) => out.push(`${i + 1}. **${a.title}**`, `   ${a.body}`, `   *依据：${a.basis}*`, ``));

  if (Object.values(r.ipip).some(v => v != null)) {
    out.push(`## 大五人格`, ``, `| 维度 | 自评 |${r.obs ? ` 朋友评价均值（${r.obsCount} 份） |` : ""}`, `|---|---|${r.obs ? "---|" : ""}`);
    for (const [d, n] of Object.entries(IPIP50.domains)) out.push(`| ${n} | ${r.ipip[d] ?? "—"} |${r.obs ? ` ${r.obs[d]} |` : ""}`);
    out.push(``, `分数范围 1 到 5，中线 3 分。`, ``);
    if (r.observers.length) {
      out.push(`### 朋友的评价`, ``);
      for (const { p } of r.observers) {
        out.push(`- **${p.nm || "匿名"}**（${p.rel || "关系未填"}，${p.t || ""}）`);
        if (p.o?.[0]) out.push(`  - 最擅长：${p.o[0]}`);
        if (p.o?.[1]) out.push(`  - 最该改：${p.o[1]}`);
      }
      out.push(``);
    }
  }
  if (Object.values(r.neo.facets).some(v => v != null)) {
    out.push(`## 大五人格 · 深度版`, ``, `| 维度 / 分面 | 分数 |`, `|---|---|`);
    for (const [d, n] of Object.entries(NEO_DOMAINS)) {
      out.push(`| **${n}** | **${r.neo.domains[d] ?? "—"}** |`);
      for (const [k, fn] of Object.entries(NEO_FACETS)) if (k[0] === d) out.push(`| 　${fn} | ${r.neo.facets[k] ?? "—"} |`);
    }
    out.push(``);
  }
  if (Object.values(r.act).some(v => v != null)) {
    out.push(`## 行动与创业特质`, ``, `| 特质 | 分数 |`, `|---|---|`);
    for (const [k, [n]] of Object.entries(ACTION_SCALES)) out.push(line(n, r.act[k], 5));
    out.push(``);
  }
  if (r.onet.code) {
    out.push(`## 职业兴趣`, ``, `兴趣代码：**${r.onet.code}**`, ``, `| 类型 | 分数（10–50） |`, `|---|---|`);
    for (const t of ONET.order) out.push(`| ${t} ${ONET.types[t][0]} | ${r.onet.scores[t]} |`);
    out.push(``);
  }
  if (r.wil.ok) {
    out.push(`## 工作价值`, ``, `| 价值 | 分数（6–30） |`, `|---|---|`);
    for (const [k, v] of r.wil.ranked) out.push(`| ${WIL_VALUES[k][0]} | ${v} |`);
    out.push(``);
  }
  for (const { c, s } of r.custom) {
    if (!s) continue;
    out.push(`## ${c.name}（自行导入）`, ``, `| 分量表 | 分数 |`, `|---|---|`);
    for (const [k, v] of Object.entries(s)) out.push(`| ${k} | ${v ?? "—"} |`);
    out.push(``);
  }
  if (includeMood && (r.mood.phq != null || r.mood.gad != null)) {
    out.push(`## 最近两周的情绪状态`, ``);
    if (r.mood.phq != null) out.push(`- PHQ-9：${r.mood.phq} 分（${r.mood.phqBand}）`);
    if (r.mood.gad != null) out.push(`- GAD-7：${r.mood.gad} 分（${r.mood.gadBand}）`);
    out.push(``, `这是筛查，不是诊断。`, ``);
  }
  if (includeInterview && Object.values(r.interview).some(v => String(v || "").trim())) {
    out.push(`## 自我访谈`, ``);
    for (const [g, qs] of INTERVIEW.groups) {
      const filled = qs.filter(([k]) => String(r.interview[k] || "").trim());
      if (!filled.length) continue;
      out.push(`### ${g}`, ``);
      for (const [k, q] of filled) out.push(`**${q}**`, ``, String(r.interview[k]).trim(), ``);
    }
  }
  out.push(`---`, ``, `由「北极星画像」生成：开源、免费、不收集数据。${SITE.repo}`);
  return out.join("\n") + "\n";
}

// 雷达图的几何：返回五个轴端点和多边形顶点（SVG 坐标），页面只负责画
export function radarGeometry(values, { size = 300, pad = 46, min = 1, max = 5 } = {}) {
  const c = size / 2, R = c - pad, n = values.length;
  const pt = (i, f) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [r2(c + Math.cos(a) * R * f), r2(c + Math.sin(a) * R * f)]; };
  const frac = v => v == null ? null : Math.max(0, Math.min(1, (v - min) / (max - min)));
  return {
    center: c, radius: R,
    axis: values.map((_, i) => pt(i, 1)),
    label: values.map((_, i) => pt(i, 1 + 22 / R)),
    rings: [0.25, 0.5, 0.75, 1].map(f => values.map((_, i) => pt(i, f))),
    poly: values.every(v => v != null) ? values.map((v, i) => pt(i, frac(v))) : null
  };
}
