# 贡献指南

原创代码与原创资料贡献按 AGPL-3.0-only 提供。贡献者保留版权，请确认自己有权贡献，并保留第三方归属与许可。本流程不包含版权转让或额外闭源授权；维护者将社区代码用于其他授权安排前，需要另行确认权利与实际组合。

## 代码

Fork 后创建分支，执行 `npm ci`、`npm test`、`npm run build`。PR 说明问题、改动与验证结果，涉及界面时核对桌面、手机、搜索、视图和详情。核心不得新增对 ReadMap 私有 API、数据库或环境凭据的依赖。宿主能力通过可选回调注入。

## 资料

修改 `public/data/homeric.json`，保留稳定 ID。在 PR 列出人物、关系、预期旧值、修改理由、具体作品／篇章或可靠研究来源。区分史诗原文、后世神话与不同异说，不把 AI 输出当作史料证明。

不得提交现代译本的完整专名索引、大段受保护译文、未经授权的插图、用户资料、搜索日志、环境文件或密钥。公开 `nameIndex` 必须保持空数组，静态导航由已审核人物数据生成。

更新快照后同步 `snapshot-info.json` 的 SHA-256 和各数组记录数，运行 `npm run check:data`。结构检查不证明史实正确或授权完整，维护者仍需核验来源。

## 维护者同步

公开核心在本仓库审核合并，独立站构建对应 commit；ReadMap 审查新增作者、依赖与许可后引入该版本。公开资料与主站数据库分别维护：先预览逐条差异、核对生产旧值和并发修改，经批准后按记录导入并保留编辑来源，最后重新导出核对。不做自动双向覆盖，代码同步不会写数据库。

许可要求依适用条款提供实际版本对应源码，不强制向本仓库提交 PR。资料问题可使用 Issue 纠错模板。

## English translations / 英文译文

Follow [docs/TRANSLATING.md](docs/TRANSLATING.md) for stable IDs, source matching, review states and terminology. Update translations when changing the Chinese source, and run `npm run check:translations`. Do not translate or reintroduce the excluded modern-translation name index or unreviewed images. Keep both READMEs aligned in all 13 sections.
