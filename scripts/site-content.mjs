// SPDX-License-Identifier: AGPL-3.0-only
export const title = '荷马史诗脉络图 · 希腊神话人物关系图 | Homeric Epic Map'
export const description = '交互式探索《伊利亚特》《奥德赛》与希腊神话：搜索诸神与英雄，在人物谱系、全景神谱和特洛伊战争阵营之间切换，查看血缘与人物关系。开源，无需数据库或账号。'
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export function siteBase(value = 'https://homeric-epic.inklinks.io/') {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('VITE_SITE_URL must be a public HTTP(S) base URL')
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return url
}
export function createSiteContent(snapshot, configuredUrl, verification = '') {
  const base = siteBase(configuredUrl)
  const e = escapeHtml
  const people = [...snapshot.figures].sort((a, b) => a.name_zh.localeCompare(b.name_zh, 'zh'))
  const sharePath = (id, prefix = './') => `${prefix}?view=tree&mode=ego&focus=${encodeURIComponent(id)}&figure=${encodeURIComponent(id)}`
  const meta = (name, content, property = false) => `<meta ${property ? 'property' : 'name'}="${name}" content="${e(content)}" />`
  const head = `<title>${e(title)}</title>${meta('description', description)}<link rel="canonical" href="${e(base.href)}" />` +
    [['og:type', 'website'], ['og:locale', 'zh_CN'], ['og:site_name', '荷马史诗脉络图'], ['og:title', title], ['og:description', description], ['og:url', base.href], ['og:image', new URL('social-preview.png', base).href], ['og:image:width', '1280'], ['og:image:height', '640'], ['og:image:alt', '荷马史诗脉络图：神祇、英雄与家族谱系']].map(([name, value]) => meta(name, value, true)).join('') +
    meta('twitter:card', 'summary_large_image') + meta('twitter:title', title) + meta('twitter:description', description) + meta('twitter:image', new URL('social-preview.png', base).href) + (verification ? meta('google-site-verification', verification) : '')
  const intro = `<section class="site-intro" aria-labelledby="intro-title"><h2 id="intro-title">荷马史诗脉络图 · Homeric Epic Map</h2><p>${e(description)}</p><p>当前快照：${people.length} 位人物 · ${snapshot.factions.length} 个类别 · ${snapshot.relations.length} 条已录入关系。包含史诗人物及辅助理解的神话谱系，不是完整神话史，也不代表所有关系都出自荷马正文。</p><p><a href="./explore/">浏览静态人物索引</a> · <a href="https://github.com/adonisly/homeric-epic-map">GitHub / Star</a> · <a href="https://readmap.inklinks.io/">阅读路书 ReadMap</a></p><p>从 <a href="${sharePath('zeus')}">宙斯家系</a>、<a href="${sharePath('achilles')}">阿基琉斯</a>、<a href="${sharePath('odysseus')}">奥德修斯</a> 开始探索。</p><p>公开版不包含现代译本的整份专名索引原文，也不提供全站搜索统计；人物资料是持续整理的学习材料，请结合原著与可靠研究核对。</p><noscript>交互图谱需要 JavaScript；静态人物索引无需 JavaScript 即可阅读。</noscript></section>`
  const sections = snapshot.factions.map(faction => `<section><h2>${e(faction.name_zh)}</h2><ul>${people.filter(person => person.faction_id === faction.id).map(person => `<li><a href="${sharePath(person.id, '../')}">${e(person.name_zh)}</a> <span lang="en">${e(person.name_en)}</span><p>${e(person.epithet || person.domain)}</p></li>`).join('')}</ul></section>`).join('')
  const catalog = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>荷马史诗与希腊神话人物索引</title><meta name="description" content="按类别浏览荷马史诗公开快照中的人物、英文名与简要介绍，进入家族谱系和人物详情。"/><link rel="canonical" href="${e(new URL('explore/', base).href)}"/><style>body{margin:0;background:#faf7f5;color:#35262d;font:16px/1.8 system-ui,sans-serif}main{max-width:960px;margin:auto;padding:32px 20px}a{color:#8c3044}h1{font-size:clamp(24px,5vw,36px)}h2{margin-top:40px;border-bottom:1px solid #dfcbd1;padding-bottom:8px}li{margin-block:16px}li p{margin:0;color:#695960}footer{padding:24px 0;border-top:1px solid #dfcbd1}a:focus-visible{outline:2px solid #8c3044;outline-offset:3px}</style></head><body><main><a href="../">返回交互图谱</a><h1>荷马史诗与希腊神话人物索引</h1><p>${people.length} 位人物，${snapshot.factions.length} 个类别。点击姓名进入图谱并打开人物详情。这是由公开人物快照生成的导航，不是现代译本的专名索引。神话存在异说，资料欢迎附来源纠错。</p>${sections}<footer><a href="https://readmap.inklinks.io/">阅读路书 ReadMap</a> · <a href="https://github.com/adonisly/homeric-epic-map/issues">资料纠错</a> · <a href="../LICENSE">AGPL-3.0 许可</a></footer></main></body></html>`
  return { head, intro, assets: {
    'explore/index.html': catalog,
    'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${e(base.href)}</loc></url><url><loc>${e(new URL('explore/', base).href)}</loc></url></urlset>\n`,
    'robots.txt': `User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap.xml', base).href}\n`,
  } }
}
