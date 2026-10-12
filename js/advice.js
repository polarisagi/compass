// 规则引擎：根据各部分的分数生成最多三条具体建议。
// 纯函数，不依赖页面，可以在 Node 里测试。不使用情绪状态（PHQ-9/GAD-7）的分数。
//
// 输入 r：
//   ipip    scoreIPIP 的结果（N 是「情绪稳定性」，分数高表示稳定）
//   obs     朋友评价的各维度均值，没有时为 null；obsCount 为份数
//   neo     scoreNEO 的结果（N 是「神经质」，分数高表示情绪更敏感）
//   act     scoreAction 的结果
//   onet    scoreONET 的结果
//   wil     scoreWIL 的结果
// 输出：[{ id, title, body, basis }]，按优先级排列，最多 3 条。

import { IPIP50, ONET } from "./instruments.js";
import { WIL_VALUES } from "./deep.js";

const has = v => v != null;
const top2 = wil => wil?.ok ? wil.ranked.slice(0, 2).map(x => x[0]) : [];
const ranks = onet => onet?.code ? Object.entries(onet.scores).sort((a, b) => b[1] - a[1]).map(x => x[0]) : [];

export function buildAdvice(r) {
  const { ipip = {}, obs = null, obsCount = 0, neo = { facets: {}, domains: {} }, act = {}, onet = {}, wil = {} } = r;
  const out = [];
  const add = (priority, id, title, body, basis) => out.push({ priority, id, title, body, basis });

  const values = top2(wil);
  const riasec = ranks(onet);
  const topInterests = riasec.slice(0, 3), lowInterests = riasec.slice(-2);
  const wantsIndependence = values.includes("IND");
  const wantsSecurity = values.includes("WC") || values.includes("SUP");
  // 情绪敏感：快速版「情绪稳定性」低，或深度版「神经质」高
  const sensitive = (has(ipip.N) && ipip.N <= 2.5) || (has(neo.domains.N) && neo.domains.N >= 3.5);
  const lowRisk = has(act.risk) && act.risk < 2.6;
  const highRisk = has(act.risk) && act.risk >= 3.8;
  const conscientious = has(ipip.C) ? ipip.C : neo.domains.C;

  // 1. 自评和他评差距大：最值得追问
  if (obs && obsCount) {
    const gaps = Object.keys(IPIP50.domains).filter(d => has(ipip[d]) && has(obs[d]))
      .map(d => [d, Math.round((obs[d] - ipip[d]) * 100) / 100]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    if (gaps.length && Math.abs(gaps[0][1]) >= 0.5) {
      const [d, g] = gaps[0], name = IPIP50.domains[d];
      add(obsCount >= 3 ? 95 : 80, "gap", `去问清楚：为什么朋友觉得你的「${name}」${g > 0 ? "更高" : "更低"}`,
        `朋友眼中的你比自评${g > 0 ? "高" : "低"} ${Math.abs(g)} 分。挑一位评价最直接的朋友，请 TA 举两件具体的事说明为什么这样看你。${g > 0 ? "别人看到的长处，往往就是你低估了、可以拿来做事的东西。" : "这一点可能是你的盲区，会影响别人和你合作的感受。"}${obsCount < 3 ? "目前只有 " + obsCount + " 份评价，再多收集几份会更可靠。" : ""}`,
        `大五人格自评 vs ${obsCount} 位朋友的评价`);
    }
  }

  // 2. 想独立，又不愿冒险，或者看重稳定
  if (wantsIndependence && (lowRisk || sensitive)) {
    add(90, "side", "先在职做副业，用数字决定什么时候离职",
      "你很看重「独立性」，但你对风险更谨慎，或者对压力更敏感。直接辞职单干，收入的不确定会消耗你很多精力。更适合的做法是：保留工作，用业余时间接第一个付费项目；事先写下离职的条件，例如副业收入连续 3 个月达到某个数，同时存够 6 个月的生活费。",
      `工作价值前两位含「独立性」；${lowRisk ? "行动特质「冒险」" + act.risk + " 分" : "情绪更敏感"}`);
  } else if (wantsSecurity && !wantsIndependence && values.length) {
    add(70, "inside", "转型时优先找能给你稳定感的路径",
      `你最看重的是「${values.map(v => WIL_VALUES[v][0]).join("」和「")}」，而不是独立性。一人公司和自由职业的最大代价恰恰是不稳定、没人撑腰。可以先考虑公司内部转岗、加入小而稳的团队，或者以兼职顾问的方式试水，而不是一步到位单干。`,
      "工作价值前两位");
  } else if (wantsIndependence && highRisk) {
    add(75, "stop", "你敢冒险，记得先写好止损线",
      `你看重独立，也愿意冒险，这是单干的好底子。容易出问题的地方是投入太快、停得太晚。开始之前写下三件事：最多投入多少钱、多少个月；到什么时候没达到什么指标就停；停下以后怎么回到原来的轨道。${has(conscientious) && conscientious < 3 ? "你的「尽责性」偏低，这几条最好写下来交给一个会监督你的人。" : ""}`,
      `工作价值含「独立性」；行动特质「冒险」${act.risk} 分`);
  }

  // 3. 行动启动
  if (has(act.init) && act.init < 3) {
    if (has(act.pers) && act.pers >= 3) add(78, "start", "你的难点是开始，不是坚持：把第一步缩小到 30 分钟以内",
      "你一旦开始就能做下去，难的是开始那一下。每个新任务先写出一个 30 分钟内能完成的第一步，并给它定一个别人知道的截止时间。外部的约束比逼自己更管用。",
      `行动启动 ${act.init} 分，坚持 ${act.pers} 分`);
    else add(82, "small", "用一周就能看到结果的小项目代替大计划",
      "开始和坚持对你来说都比较费力，所以大而长的计划很容易半途而废。把目标拆成一周内能交付的小项目，每做完一个就给一个人看，让反馈推着你走。找一位搭子定期对进度，比单打独斗有效得多。",
      `行动启动 ${act.init} 分${has(act.pers) ? "，坚持 " + act.pers + " 分" : ""}`);
  } else if (!has(act.init) && has(neo.facets.C5) && neo.facets.C5 <= 2.5) {
    add(76, "start", "给自己加外部结构：固定时间、公开承诺",
      "深度版里你的「自律」分面偏低，这通常表现为拖延。不要靠意志力，靠结构：每天固定一段不被打扰的工作时间，把要交付的东西公开告诉别人。",
      `深度版「自律」分面 ${neo.facets.C5} 分`);
  }

  // 4. 职业兴趣与做事方式
  if (topInterests.length) {
    const eTop = topInterests.includes("E"), eLow = lowInterests.includes("E");
    const introvert = has(ipip.E) && ipip.E <= 2.6;
    if (eTop && introvert) add(74, "media", "喜欢影响别人，但社交耗能：用一对多的方式代替一对一",
      "你的兴趣里有明显的「企业型」（影响、说服、带领别人），但性格偏内向，大量见人会很累。写文章、做视频、做开源项目这类一对多的方式，可以让你在不消耗太多社交精力的情况下获得影响力和客户。",
      `兴趣代码 ${onet.code}；外向性 ${ipip.E} 分`);
    else if (eTop) add(66, "sell", "销售对你不是负担，把它排进每周固定日程",
      "「企业型」是你最强的兴趣之一。很多程序员单干失败，是因为不愿意卖；你没有这个障碍。每周固定留出半天专门做对外的事：联系潜在客户、发内容、谈合作。",
      `兴趣代码 ${onet.code}`);
    else if (eLow && wantsIndependence) add(72, "partner", "单干的话，获客最好交给别人或平台",
      "你看重独立，但「企业型」是你最弱的兴趣，也就是说你大概率不喜欢推销自己。如果要做一人公司或自由职业，优先考虑通过接单平台、熟人介绍，或者和一个擅长销售的人合作，而不是逼自己天天去推销。",
      `兴趣代码 ${onet.code}，「企业型」排在最后两位`);
    else if (onet.spread != null && onet.spread < 10) add(62, "probe", "兴趣分化低：用三个小实验代替反复想",
      `你各类兴趣的分数很接近（最高和最低只差 ${onet.spread} 分），光靠想很难选出方向。接下来两周，从兴趣代码 ${onet.code} 里挑三类，各做一件真实的小事（接一个小活、做一个小作品、去听一次课），做完记下哪件让你忘了时间。`,
      `兴趣分化度 ${onet.spread} 分`);
    else {
      const t = topInterests[0];
      add(55, "fit", `从「${ONET.types[t][0]}」的工作方式出发找方向`,
        `你兴趣最强的是「${ONET.types[t][0]}」：${ONET.types[t][1]}。评估一个新方向时，先问自己：这件事每天的具体工作，有多少属于这一类？比例越高，你越容易长期投入。`,
        `兴趣代码 ${onet.code}`);
    }
  }

  // 5. 性格组合
  const O = has(ipip.O) ? ipip.O : neo.domains.O;
  if (has(O) && O >= 4 && has(conscientious) && conscientious <= 3) add(68, "focus", "点子多、收尾难：同一时间只推进一个项目",
    "你的开放性很高，新想法源源不断，但尽责性不算高，容易同时开很多个头。规定自己同一时间只推进一个项目，新点子先记在清单里，等手上的做完（或者明确放弃）再挑下一个。",
    `开放性 ${O} 分，尽责性 ${conscientious} 分`);
  else if (has(conscientious) && conscientious <= 2.5) add(64, "structure", "用外部结构代替自律",
    "你的尽责性偏低，按计划做事对你来说比较费力。这不是缺点，只是需要借助外部结构：固定的作息、交付日期、能检查你进度的合作者。如果要单干，尽早找一个能督促你的伙伴或客户。",
    `尽责性 ${conscientious} 分`);
  if (sensitive && !out.some(x => x.id === "side")) add(60, "buffer", "先准备好缓冲，再做大的改变",
    "你对压力比较敏感。换工作、单干这类变化本身就会带来很多压力，最好先把缓冲准备好：6 个月以上的生活费、一个可以随时聊的人、一个固定的运动或休息习惯。缓冲越足，你越能做出好的判断。",
    has(ipip.N) ? `情绪稳定性 ${ipip.N} 分` : `深度版神经质 ${neo.domains.N} 分`);
  if (values[0] === "ACH" && !out.some(x => x.id === "fit")) add(50, "ach", "选能看见成果的工作",
    "「成就感」是你最看重的工作价值。挑方向时，优先选能直接看到自己做出了什么的工作，比如独立负责一个产品、一个客户、一个可以展示的作品；尽量避开只是大系统里一颗螺丝钉的位置。",
    "工作价值第一位");

  // 6. 数据不够时，提醒补齐最有用的部分
  if (!obsCount) add(40, "invite", "邀请 3 位了解你的人来评价你",
    "自评只是一半。把「评价朋友」页的邀请链接发给 3 位共事过或者很熟的人，他们大约用 6 分钟。别人眼中的你，往往能告诉你自评看不到的长处和盲区。",
    "还没有朋友的评价");
  if (!onet.code) add(38, "onet", "做完「职业兴趣」，建议会具体得多", "职业兴趣决定了哪类工作能让你长期投入，是选择方向时最重要的参考之一，大约 8 分钟。", "职业兴趣未完成");
  if (!wil.ok) add(36, "wil", "做完「工作价值」卡片", "工作价值告诉你选择工作时最不该牺牲什么，比如独立、稳定还是成就感，大约 5 分钟。", "工作价值未完成");
  if (!has(act.init)) add(34, "act", "做完「行动与创业特质」", "这一部分看你能不能马上开始、能不能坚持、敢不敢冒险，对判断适不适合单干很有帮助，大约 6 分钟。", "行动与创业特质未完成");

  // 去重：同一个 id 只留一次，按优先级取前三
  const seen = new Set();
  return out.sort((a, b) => b.priority - a.priority).filter(x => !seen.has(x.id) && seen.add(x.id)).slice(0, 3)
    .map(({ id, title, body, basis }) => ({ id, title, body, basis }));
}
