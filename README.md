# 荷马史诗脉络图 · 希腊神话人物关系图 | Homeric Epic Map

[![License: AGPL-3.0-only](https://img.shields.io/badge/License-AGPL--3.0--only-blue.svg)](LICENSE)

**开源许可：本项目原创代码采用 [AGPL-3.0-only](LICENSE)（仅第 3 版）。** 修改版本通过网络与用户交互时，须按许可向这些用户提供该版本的完整对应源码。第三方依赖保留各自的许可与声明。

一个面向**荷马史诗阅读、希腊神话入门与古希腊文学学习**的开源交互式知识图谱。通过可搜索的人物地图，梳理《伊利亚特》《奥德赛》中的神祇、英雄、家族谱系与特洛伊战争阵营关系。

**当前公开快照：208 位人物 · 9 个类别 · 328 条关系 · 3 种展示模式 · 无需数据库**

**[在线体验：开源独立版（推荐）](https://homeric-epic.inklinks.io/)**

专注人物与关系浏览，内容随开源版本更新；纠错和建议通过 [GitHub Issues](https://github.com/adonisly/homeric-epic-map/issues) 提交。

A Chinese-language, interactive **Homeric epic map** and **Greek mythology family tree** for exploring the **Iliad**, **Odyssey**, Olympian gods, Greek heroes and Trojan War factions. Search Chinese, English, Roman names, pinyin and initials. Runs with bundled JSON data; no database, login or API key required.

[![荷马史诗脉络图界面：诸神阵营关系、人物卡片与搜索入口](assets/overview.jpg)](https://homeric-epic.inklinks.io/)

## 操作演示

[观看约 21 秒完整操作演示（MP4，约 1 MB，中文字幕）](assets/demo.mp4) · [录制内容与分镜](docs/DEMO.md)

<details>
<summary>查看 15 秒动图预览：搜索、人物详情与谱系切换</summary>

![实际操作演示预览：拼音首字母搜索奥德修斯、定位人物并打开详情，附中文操作说明](assets/demo.gif)

</details>

以上为实际运行页面的界面采集，展示图谱的局部视图。完整内容可在[在线版](https://homeric-epic.inklinks.io/)中搜索和探索。后续版本将阵营图例改为默认折叠，具体界面差异见演示说明。

## 30 秒上手

1. 从默认的宙斯「人物谱系」出发，查看直系祖先、同辈、配偶与后代。
2. 搜索「奥德修斯」「odysseus」或「adxs」，选择建议中的人物，定位卡片并打开详情。
3. 切换「全景谱系」观察代际联系，或打开「阵营关系图」查看希腊联军、特洛伊阵营与诸神。

如果这个工具对阅读有帮助，欢迎通过标题栏的 **源码 · AGPL-3.0** 入口前往 GitHub，点击 **Star** 收藏项目；资料纠错请通过 [Issues](https://github.com/adonisly/homeric-epic-map/issues) 提交并附上来源。

## 分享与探索

- 点击标题栏的「分享当前视图」，复制展示模式、焦点人物、已打开的详情与搜索词；点击人物详情中的「分享此人物」，让对方直接进入对应人物。链接保留当前站点的域名与路径，不保存缩放、滚动或本机搜索历史。
- 从「宙斯家系」「阿基琉斯」「奥德修斯」三个入口开始探索。
- [人物索引](https://homeric-epic.inklinks.io/explore/)无需 JavaScript 即可阅读，点击姓名进入对应图谱；该导航由公开人物数据生成，不是现代译本的专名索引。
- 示例：[宙斯家系](https://homeric-epic.inklinks.io/?view=tree&mode=ego&focus=zeus)、[阿基琉斯人物详情](https://homeric-epic.inklinks.io/?view=tree&mode=ego&focus=achilles&figure=achilles)、[奥德修斯人物详情](https://homeric-epic.inklinks.io/?view=tree&mode=ego&focus=odysseus&figure=odysseus)。

## 在线版本与更多阅读资源

**[ReadMap 主站版](https://readmap.inklinks.io/knowledge-graphs/homeric-epic)**

荷马史诗图谱源自 **[阅读路书 ReadMap](https://readmap.inklinks.io/)**，两个版本复用同一套图谱核心，分别维护数据与发布。ReadMap 通过主题阅读路径和知识图谱，连接书、人物、时代与思想，还提供：

- **[阅读路径](https://readmap.inklinks.io/reading-paths)**：按主题和学科查看系统化、分层次的阅读路线。
- **[更多知识图谱](https://readmap.inklinks.io/knowledge-graphs)**：继续探索[西方哲学](https://readmap.inklinks.io/knowledge-graphs/western-philosophy)、[西方音乐史](https://readmap.inklinks.io/knowledge-graphs/western-music)、[佛教史](https://readmap.inklinks.io/knowledge-graphs/buddhism-history)和[中国历史朝代](https://readmap.inklinks.io/knowledge-graphs/chinese-dynasties)。
- **[阅读社区入口](https://bookclub.inklinks.io/)**：跳转到配套的外部阅读社区。
- **资源检索与课程入口**：[网盘搜索](https://readmap.inklinks.io/pan-search)聚合多来源资源检索，[课程资源](https://readmap.inklinks.io/resources)集中整理课程信息；这两个入口需访问口令。

独立版保留图谱核心与公开人物资料，**不包含现代译本的整份专名索引原文及其全部地名、族群、物名释义，也不包含未经审核的插图**；主站保留原有专名检索范围与宿主统计能力。内容更新时间和反馈方式也可能不同，不能将独立版描述成主站所有内容与服务的完整镜像。需要更多主题和阅读资源时，可以从[阅读路书首页](https://readmap.inklinks.io/)继续。

## 用人物地图梳理荷马史诗

- **荷马史诗人物关系图**：结合人物卡片与关系，梳理神祇、英雄及其亲属、敌友与战争联系。
- **希腊神话家族谱系**：在人物谱系中切换焦点，查看祖先血缘主链、同辈、配偶和子女；通过全景谱系观察代际与家族交错。
- **特洛伊战争阵营图**：查看希腊联军、特洛伊及其盟军，以及倾向不同阵营的诸神。
- **人物搜索与译名对照**：使用中文名、英文名、罗马名、别名、拼音全拼与首字母搜索，也可按神职和称号关键词寻找人物。
- **史诗阅读辅助**：打开人物详情，阅读整理简介、身份与亲属关系；保留异说提示，帮助回到原著与可靠研究继续核对。

## 内容覆盖：神祇、英雄与家族谱系

图谱收录了荷马史诗及辅助理解的希腊神话人物与关系，具体内容以仓库内的数据快照为准。例如：

- **诸神与神话谱系**：宙斯、赫拉、雅典娜等人物，以及创世之神、泰坦神族、奥林匹斯神、海洋神系等类别。
- **《伊利亚特》与希腊联军**：阿基琉斯、阿伽门农、帕特罗克洛斯等英雄及其家族、战争关系。
- **特洛伊及其盟军**：赫克托耳、帕里斯、普里阿摩斯等人物与关联家族。
- **《奥德赛》与归乡世界**：奥德修斯、裴奈罗佩、忒勒马科斯等人物，以及伊塔卡与归乡叙事中的关系。
- **英雄与家族**：辅助阅读所需的通行神话谱系；不能把所有人物与连线都视为荷马正文直接记载。

**English subject areas:** Homeric epic, Iliad, Odyssey, Greek mythology, Olympian gods, Greek heroes, Trojan War, genealogy, family trees and classical literature.

## 学习与使用

### 如何梳理《伊利亚特》《奥德赛》的人物关系？

可以先搜索正在阅读的人物，在详情中查看简介与亲属关系；再切换人物谱系追踪家族，或在阵营关系图中查看特洛伊战争各方。清除搜索后，可以继续浏览更大范围的人物。

### 可以当作荷马史诗思维导图或希腊神话家谱使用吗？

可以把它作为交互式人物关系图和神话家谱，辅助史诗阅读、人物辨认与阅读笔记整理。图谱结合史诗与通行神话，神话存在不同异说，资料也并非完整的史料校订成果；重要关系请结合原著与可靠研究核对，欢迎附来源纠错。

### 需要数据库或账号吗？

浏览在线图谱、在本地运行和部署静态版本均不需要数据库、账号或 API key。项目基于 React、TypeScript 与定制 DOM / SVG 布局，默认读取仓库自带的公开 JSON 数据。

## 本地运行

需要 Node.js 22.12 或更新版本；CI 使用 Node.js 24。

```bash
npm ci
npm run dev
```

打开 `http://127.0.0.1:3200`。

```bash
npm test
npm run build
npm run preview
```

构建结果在 `dist/`，可部署到 GitHub Pages、Vercel 或其他静态网站托管服务。构建使用相对资源路径，也支持部署在子目录。

## 功能与数据

- 中文、英文、罗马名、别名、拼音全拼和首字母搜索；支持神职与称号关键词。
- 人物谱系、全景谱系、阵营关系三种展示模式；可切换焦点人物与类别。
- 人物详情、整理简介、亲属称谓、关系方向与异说说明。
- 各视图独立缩放、祖先血缘主链、探索历史与分享链接。
- 搜索历史保存在当前浏览器的本地存储中，可清除；独立版不上传搜索词、不加载主站热搜。

`public/data/homeric.json` 保存人物、类别、关系和关系类型；字段与关系方向见 [数据说明](docs/DATA.md)。`nameIndex` 保持空数组，不分发现代译本的整份专名索引；`image_url` 为 null，不分发未经审核的插图。`snapshot-info.json` 记录导出时间、记录数、来源与 SHA-256；修改快照后需同步更新并运行 `npm run check:data`。

同一份公开人物数据与同一版本核心使用相同的布局和渲染逻辑。静态版不会实时接收 ReadMap 数据库更新，不提供主站完整专名索引、全站搜索次数统计、登录和管理后台；反馈入口链接到 GitHub Issues。不同浏览器、字体、视口和本机历史也可能影响显示。

## 贡献

欢迎通过 Issue 提出纠错，或通过 Pull Request 贡献代码与资料。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。请注明具体作品、篇章、版本或可靠研究来源，区分史诗原文与后世神话，保留稳定人物 ID，并说明关系方向与异说依据。

请勿提交现代译本的完整索引、大段受保护译文、未经授权的插图、用户记录或凭据。结构检查不等于史实与授权已经完成审核。

想向同学或读书伙伴介绍这个项目？可参考[项目介绍与演示示例](docs/SHARING.md)，并使用仓库内的截图和动图。

## 网站搜索与分享配置

构建会从公开快照生成首页静态介绍、人物索引、sitemap.xml 和 robots.txt，并加入 canonical、Open Graph 与 Twitter Card。它们改善内容读取与链接预览，不保证收录或排名。

自行部署到其他域名或子目录时，用实际公开地址构建：

```bash
VITE_SITE_URL=https://example.com/map/ VITE_SOURCE_URL=https://github.com/your-name/your-repo/tree/your-commit npm run build
```

默认公开地址为本项目独立站。迁移域名时也需修改或移除 `public/CNAME`，并配置托管平台的对应域名。分享封面为 [public/social-preview.png](public/social-preview.png)，可编辑源文件为 [assets/social-preview.svg](assets/social-preview.svg)；自建站请替换封面上的域名。GitHub 仓库的 Social preview 需在仓库 Settings 单独上传，网站 Open Graph 不会代替该设置。

如需接入 Google Search Console，可在仓库 Settings → Secrets and variables → Actions → Variables 中设置 `GOOGLE_SITE_VERIFICATION` 为自己账号生成的 HTML 标签 `content` 值。工作流将其传入构建；其他平台可设置 `VITE_GOOGLE_SITE_VERIFICATION`。未配置时不输出验证标签，fork 不会自动继承原维护者账号。完成验证后应保留配置，并在自己的资源中提交 sitemap。`VITE_*` 会进入公开产物，不能用于保存秘密。

版本变更见 [CHANGELOG.md](CHANGELOG.md)，公开字段、来源范围与校验方法见 [docs/DATA.md](docs/DATA.md)。

## 复用图谱核心

`src/HomericGraph.tsx` 是独立站与 ReadMap 共用的实现。主站注入 `graph` 数据，以及可选的 `loadHotSearches`、`trackSearch` 等宿主回调；`src/main.tsx` 是静态 JSON 适配入口。类型、搜索、亲属称谓与配色也由公开仓库维护，核心不依赖 Next.js、Supabase 或 ReadMap 的服务端代码。

代码改进在本仓库审核合并，ReadMap 再引入对应版本，两边分别发布。公开 PR 不会直接写入生产数据库；资料修订需按记录差异审核和导入，不能用公开 JSON 整表覆盖数据库。具体流程见贡献指南。

## 许可

项目原创代码采用 **GNU Affero General Public License v3.0（SPDX：`AGPL-3.0-only`，仅第 3 版）**，完整条款见 [LICENSE](LICENSE)。

- **允许使用、修改、分发和商用**，须遵守许可规定的版权、许可声明及适用的源码提供要求。
- **修改后通过网络向用户提供服务**，须按许可向这些用户显著提供免费获取该版本完整对应源码的入口。
- 可以 Fork 并按许可复用，不要求向本仓库提交 PR；贡献者保留版权，贡献流程不包含额外闭源授权或版权转让，见 [CONTRIBUTING.md](CONTRIBUTING.md)。

独立站标题栏的“源码 · AGPL-3.0”入口指向部署版本的源码。自行修改并部署时，应将 `VITE_SOURCE_URL` 设置为实际部署版本的完整对应源码地址。GitHub Actions 自动使用本次构建的提交；其他环境默认指向本项目 `main`，部署者需要核对或覆盖。

版权与归属见 [NOTICE.md](NOTICE.md)，依赖许可见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。代码与原创整理表达按项目标明的许可提供；事实、名称与引用作品保留其适用权利，不将现代译本、插图等第三方材料自动视为可再授权内容。维护者将社区贡献用于其他授权安排前，仍需核对实际权利与组合方式。
