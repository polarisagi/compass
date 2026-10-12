# 北极星画像（Polaris Compass）

> 开源、免费、不收集数据的职业与性格自我了解工具。由 [PolarisAGI](https://polarisagi.online) 发起。
>
> 在线使用：**https://compass.polarisagi.online**

## 能做什么

| 模块 | 题数 | 用时 | 来源 |
|---|---|---|---|
| 大五人格 · 快速版 | 50 | 约 6 分钟 | IPIP Big-Five Factor Markers（公有领域） |
| 朋友他评 | 50 | 约 6 分钟（朋友来做） | 同上，他评版本 |
| 大五人格 · 深度版 | 116 | 约 15 分钟 | IPIP-NEO-120（公有领域），29 个分面 |
| 行动与创业特质 | 46 | 约 6 分钟 | IPIP 行动启动、坚持、冒险、创新、好奇心（公有领域） |
| 职业兴趣（RIASEC） | 60 | 约 8 分钟 | 改编自 O\*NET Interest Profiler Short Form |
| 工作价值 | 20 张卡片 | 约 5 分钟 | 改编自 O\*NET Work Importance Locator |
| 自我访谈 | 14 | 约 15 分钟 | 原创 |
| 情绪状态（可选） | 16 | 约 3 分钟 | PHQ-9 + GAD-7 |
| 导入你自己的题库 | — | — | 用户自行提供，见 [题库格式](docs/题库格式.md) |

**特点：**
- **「你眼中的自己」和「朋友眼中的你」对比。** 在报告页复制邀请链接发给朋友，朋友在自己的设备上作答，生成一段结果码发回给你，你粘贴进来就能在雷达图和条形图上看到对比。全程不经过任何服务器。
- **三条具体建议。** 报告开头根据你已完成的部分，由固定规则（`js/advice.js`）生成三条建议，比如「先在职做副业，用数字决定什么时候离职」，每条都写明依据。不使用情绪状态的分数。
- **零数据收集。** 纯静态网页，没有任何网络请求，所有作答只保存在浏览器的 localStorage 里。
- **报告可以带走。** 导出 Markdown 报告、打印或存成 PDF；导出和恢复全部数据的 JSON 备份。
- **只内置允许公开分发的题目。** 其他量表可以由用户自行导入，本项目不提供这些内容。

## 运行

纯静态网页，不需要构建。由于使用了 ES 模块，需要通过 HTTP 访问，不能直接双击打开 `index.html`。

```bash
python3 -m http.server 8000   # 然后打开 http://localhost:8000
node --test                   # 运行测试（Node 18 以上）
```

## 部署

线上版本部署在 Cloudflare Pages（项目名 `compass`，自定义域名 `compass.polarisagi.online`）。

```bash
npx wrangler login                                                   # 第一次需要
npx wrangler pages project create compass --production-branch main   # 第一次需要
sh scripts/deploy.sh                                                 # 跑测试，然后只上传站点文件
```

`_headers` 设置了安全响应头：内容安全策略禁止一切网络请求（`connect-src 'none'`），只允许从 Google Fonts 加载字体。也可以部署到 GitHub Pages 等任何静态托管服务，把 `index.html`、`css/`、`js/` 放上去就行。

想换成自己的域名和联系方式，只需要改 `js/config.js`。

## 目录

```text
index.html          页面入口
_headers            Cloudflare Pages 响应头（安全策略）
css/style.css       样式（浅色、深色和打印）
js/config.js        站点地址、仓库地址、作者联系方式
js/instruments.js   内置题库：快速版、职业兴趣、情绪、访谈（注明来源和条款）
js/deep.js          内置题库：深度版、行动与创业特质、工作价值卡片
js/scoring.js       计分（纯函数）
js/advice.js        三条建议的规则引擎（纯函数）
js/report.js        报告汇总、Markdown 导出、雷达图几何（纯函数）
js/custom.js        自行导入题库的校验和计分
js/app.js           页面逻辑和路由（#report、#observe?for=称呼 等）
tests/              node:test 测试
scripts/deploy.sh   部署到 Cloudflare Pages
docs/题库格式.md     自行导入题库的 JSON 格式
docs/授权申请.md     向原作者申请收录授权的记录和信件模板
NOTICE.md           第三方内容的来源和条款
声明.md              使用声明（与网页「声明」页一致）
```

## 作者

由 mrlaoliai（[PolarisAGI](https://polarisagi.online)）开发和维护。反馈和建议请提交 [issue](https://github.com/polarisagi/compass/issues)，或者写信到 hello@polarisagi.online。

## 许可

- 代码和原创文字：[MIT](LICENSE)
- 第三方题目：各自的条款，见 [NOTICE.md](NOTICE.md)

## 免责

本工具不是心理诊断，也不是职业建议，不适用于招聘、录取等对他人有重大影响的决定，也不适用于未满 18 周岁的人。完整内容见 [声明.md](声明.md)。
