// 用户自行导入的题库：只做格式校验和计分，不内置任何题目。
// 格式说明见 docs/题库格式.md
export const FORMAT = "polaris-compass/questionnaire@1";

export function validateCustom(q) {
  const fail = m => { throw new Error(m); };
  if (!q || q.format !== FORMAT) fail(`缺少 "format": "${FORMAT}"`);
  if (!/^[a-z0-9_-]{1,40}$/i.test(q.id || "")) fail("id 只能包含字母、数字、下划线和连字符，长度不超过 40");
  if (typeof q.name !== "string" || !q.name.trim() || q.name.length > 60) fail("name 必填，长度不超过 60");
  if (!Number.isInteger(q.min) || !Number.isInteger(q.max) || q.max <= q.min || q.max - q.min > 10) fail("min 和 max 必须是整数，且 max 大于 min，两者相差不超过 10");
  if (!Array.isArray(q.labels) || q.labels.length !== q.max - q.min + 1 || q.labels.some(l => typeof l !== "string")) fail("labels 的数量必须等于 max - min + 1");
  if (!Array.isArray(q.items) || !q.items.length || q.items.length > 300 || q.items.some(t => typeof t !== "string" || !t.trim())) fail("items 必须是 1 到 300 条非空文字");
  if (!q.scales || typeof q.scales !== "object" || !Object.keys(q.scales).length) fail("scales 至少要有一个分量表");
  for (const [name, list] of Object.entries(q.scales)) {
    if (!Array.isArray(list) || !list.length) fail(`分量表「${name}」不能为空`);
    for (const n of list) if (!Number.isInteger(n) || n === 0 || Math.abs(n) > q.items.length) fail(`分量表「${name}」里的题号 ${n} 无效（负数表示反向计分，范围是 1 到 ${q.items.length}）`);
  }
  // 只保留已知字段，并去掉文字里的标签，防止导入文件注入页面结构
  const clean = s => String(s).replace(/[<>]/g, "").slice(0, 2000);
  return {
    format: FORMAT, id: q.id, name: clean(q.name), source: clean(q.source || ""), intro: clean(q.intro || ""),
    min: q.min, max: q.max, labels: q.labels.map(clean), items: q.items.map(clean),
    scales: Object.fromEntries(Object.entries(q.scales).map(([k, v]) => [clean(k), v.slice()]))
  };
}

export function scoreCustom(q, answers) {
  const out = {};
  let any = false;
  for (const [name, list] of Object.entries(q.scales)) {
    const vals = list.map(n => { const v = answers[Math.abs(n)]; return v == null ? null : n < 0 ? q.min + q.max - v : v; });
    if (vals.some(v => v == null)) { out[name] = null; continue; }
    out[name] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100; any = true;
  }
  return any ? out : null;
}
