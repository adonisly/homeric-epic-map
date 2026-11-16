# Translation maintenance / 双语维护

The Chinese site at `/` and English site at `/en/` share one graph core, deployment and structural snapshot. Translation is static and versioned; visitors do not call a translation API.

## Stable structure and source matching

- `public/data/homeric.json` remains the shared public source: 208 characters, 9 categories, 328 relations and 8 relation types.
- `public/data/locales/en.json` stores translations under unchanged figure and relationship IDs. Each field has `source`, `text` and `review` (`draft` or `reviewed`). Arrays preserve their length and ordering.
- `src/i18n/content.mjs` matches source text and constructs display records without changing IDs, relationship endpoints, direction, confidence, faction keys, generation values or group keys. `src/i18n/index.ts` contains UI labels and name presentation.
- Existing English and Roman names are reused. English kinship labels respect gender and relation direction; incoming “kills” relationships read “Killed by”, rather than reversing who killed whom.
- No modern translation’s full name index is included or translated. `nameIndex=[]` and `image_url=null` remain unchanged. Do not add private index entries or unreviewed images to translation files.

## Edit and review

1. Find the entity by stable ID and compare the complete Chinese source and context.
2. Change `text`. If the source changed, translate the changed text before updating `source`; never refresh only the source match to make an old translation look current.
3. Keep `draft` until the entire field has received editorial review. Describe terminology corrections in the PR; cite reliable sources for factual changes. Coverage checks do not prove mythological accuracy.
4. Run `npm run check:translations`, `npm test` and `npm run build`; open the affected entry in both languages, including a narrow screen.
5. Check that shared links and language switching preserve the actual current view, focus, category, search and open character, while unrelated host URL parameters are removed. Scrolling, zoom and local navigation history are not shared.
6. Keep README.md and README.en.md aligned in all 13 sections, retain ReadMap attribution, and accurately state the interface/caption language of demo assets.

Missing, malformed or stale translations fall back to the Chinese source. English details explicitly identify fallback; the build rejects incomplete or stale content. A host with newer live content may retain Chinese fields until translations catch up.

## Editorial scope and conventions

Initial content used Google Translate on the already-public snapshot, followed by manual curation of group labels, selected roles and epithets, central character summaries and terminology. General biographies, variants and interpretations remain **machine-assisted editorial drafts**, not a completed scholarly audit.

Use the existing canonical English names for navigation (Zeus, Athena, Achilles, Odysseus, etc.), retain Roman names as a distinct field, and use conventional titles such as *Iliad*, *Odyssey* and *Theogony*. Preserve the original note's qualifications and variant traditions; do not turn “in one account” into a definitive claim or reverse a relationship's subject and object. Later mythological background is included to aid reading and is not automatically attributed to Homer's text.

Public original code remains AGPL-3.0-only. Translation work does not grant additional rights to third-party works or previously excluded material. See NOTICE.md, THIRD-PARTY-NOTICES.md and CONTRIBUTING.md.

## 中文维护摘要

中英文共用核心和稳定结构；只翻译已允许公开的字段。原文更新后逐字段检查译文，不修改关系方向、置信度或分组键来凑英文显示。神职、别名、异说、亲属称谓、三种视图、搜索和分享都要回归，尤其注意长英文名和手机。

现代译本整份专名索引及未审核图片继续排除，不能因为翻译而扩大公开范围。主站默认仍使用中文宿主；英文由宿主明确注入语言和匹配译文，独立站路径不硬编码到主站。
