// SPDX-License-Identifier: AGPL-3.0-only
import { localizeGraph, factionName } from '../src/i18n/content.mjs'
export const title='荷马史诗脉络图 · 希腊神话人物关系图 | Homeric Epic Map'
export const description='交互式探索《伊利亚特》《奥德赛》与希腊神话：搜索诸神与英雄，在人物谱系、全景神谱和特洛伊战争阵营之间切换，查看血缘与人物关系。开源，无需数据库或账号。'
export const englishTitle='Homeric Epic Map | Greek Mythology, Characters & Family Trees'
export const englishDescription='Explore gods and heroes from the Iliad, the Odyssey and Greek mythology. Search names, trace family trees and discover Trojan War factions. Free, bilingual and open source; no account required.'
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function siteBase(value='https://homeric-epic.inklinks.io/') {
  const url=new URL(value)
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('VITE_SITE_URL must be a public HTTP(S) base URL')
  if(!url.pathname.endsWith('/'))url.pathname+='/'
  return url
}
export function createSiteContent(snapshot,configuredUrl,verification='',translations={}) {
  const base=siteBase(configuredUrl),e=escapeHtml
  const meta=(name,value,property=false)=>`<meta ${property?'property':'name'}="${name}" content="${e(value)}"/>`
  const alternates=path=>`<link rel="alternate" hreflang="zh-CN" href="${e(new URL(path,base).href)}"/><link rel="alternate" hreflang="en" href="${e(new URL('en/'+path,base).href)}"/><link rel="alternate" hreflang="x-default" href="${e(new URL(path,base).href)}"/>`
  function localized(en) {
    const prefix=en?'en/':'',url=new URL(prefix,base),t=en?englishTitle:title,desc=en?englishDescription:description
    const graph=localizeGraph(snapshot,en?'en':'zh',translations)
    const name=p=>en?(p.name_en||p.name_zh):p.name_zh
    const people=[...graph.figures].sort((a,b)=>name(a).localeCompare(name(b),en?'en':'zh'))
    const sharePath=(id,prefix='./')=>`${prefix}?view=tree&mode=ego&focus=${encodeURIComponent(id)}&figure=${encodeURIComponent(id)}`
    const image=new URL(en?'social-preview-en.png':'social-preview.png',base).href
    const head=`<title>${e(t)}</title>${meta('description',desc)}<link rel="canonical" href="${e(url.href)}"/>${alternates('')}`+
      [['og:type','website'],['og:locale',en?'en_US':'zh_CN'],['og:locale:alternate',en?'zh_CN':'en_US'],['og:site_name',en?'Homeric Epic Map':'荷马史诗脉络图'],['og:title',t],['og:description',desc],['og:url',url.href],['og:image',image],['og:image:width','1280'],['og:image:height','640'],['og:image:alt',en?'Homeric Epic Map: gods, heroes and family lineages':'荷马史诗脉络图：神祇、英雄与家族谱系']].map(([k,v])=>meta(k,v,true)).join('')+
      meta('twitter:card','summary_large_image')+meta('twitter:title',t)+meta('twitter:description',desc)+meta('twitter:image',image)+(verification?meta('google-site-verification',verification):'')
    const examples=['zeus','achilles','odysseus'].map(id=>people.find(p=>p.id===id)).filter(Boolean)
    const intro=`<section class="site-intro" aria-labelledby="intro-title"><h1 id="intro-title">${en?'Homeric Epic Map':'荷马史诗脉络图 · Homeric Epic Map'}</h1><p>${e(desc)}</p><p>${en?`${people.length} characters · ${graph.factions.length} categories · ${graph.relations.length} recorded relationships. Includes background mythological genealogies; not every figure or relationship appears in Homer.`:`当前快照：${people.length} 位人物 · ${graph.factions.length} 个类别 · ${graph.relations.length} 条已录入关系。包含史诗人物及辅助理解的神话谱系，不是完整神话史，也不代表所有关系都出自荷马正文。`}</p><p><a href="./explore/">${en?'Browse the character index':'浏览静态人物索引'}</a> · <a href="${en?'../':'./en/'}">${en?'中文':'English'}</a> · <a href="https://github.com/adonisly/homeric-epic-map">GitHub / Star</a> · <a href="https://readmap.inklinks.io/">ReadMap${en?' (Chinese)':''}</a></p><p>${examples.map(p=>`<a href="${sharePath(p.id)}">${e(name(p))}</a>`).join(' · ')}</p><p>${en?'This edition excludes the full name index from modern translations and unreviewed images. English study notes are machine-assisted drafts; verify important claims against primary works and reliable scholarship.':'公开版不包含现代译本的整份专名索引原文，也不提供全站搜索统计；人物资料是持续整理的学习材料，请结合原著与可靠研究核对。'}</p><noscript>${en?'The interactive map requires JavaScript; the character index can be read without JavaScript.':'交互图谱需要 JavaScript；静态人物索引无需 JavaScript 即可阅读。'}</noscript></section>`
    const sections=graph.factions.map(f=>`<section><h2>${e(factionName(f,en?'en':'zh'))}</h2><ul>${people.filter(p=>p.faction_id===f.id).map(p=>`<li><a href="${sharePath(p.id,'../')}">${e(name(p))}</a> <span lang="${en?'zh-CN':'en'}">${e(en?p.name_zh:p.name_en)}</span><p>${e(p.epithet||p.domain)}</p></li>`).join('')}</ul></section>`).join('')
    const catalog=`<!doctype html><html lang="${en?'en':'zh-CN'}"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${en?'Homeric Characters & Greek Mythology Index':'荷马史诗与希腊神话人物索引'}</title>${meta('description',en?'Browse gods, heroes and family lineages in the public Homeric snapshot. Select a character to open their family view and details.':'按类别浏览荷马史诗公开快照中的人物、英文名与简要介绍，进入家族谱系和人物详情。')}<link rel="canonical" href="${e(new URL(prefix+'explore/',base).href)}"/>${alternates('explore/')}<style>body{margin:0;background:#faf7f5;color:#35262d;font:16px/1.8 system-ui,sans-serif}main{max-width:960px;margin:auto;padding:32px 20px}a{color:#8c3044}h1{font-size:clamp(24px,5vw,36px)}h2{margin-top:40px;border-bottom:1px solid #dfcbd1;padding-bottom:8px}li{margin-block:16px}li p{margin:0;color:#695960}footer{padding:24px 0;border-top:1px solid #dfcbd1}a:focus-visible{outline:2px solid #8c3044;outline-offset:3px}</style></head><body><main><nav><a href="../">${en?'Back to the interactive map':'返回交互图谱'}</a> · <a href="${en?'../../explore/':'../en/explore/'}">${en?'中文':'English'}</a></nav><h1>${en?'Homeric Characters & Greek Mythology':'荷马史诗与希腊神话人物索引'}</h1><p>${en?`${people.length} characters in ${graph.factions.length} categories. Select a name to open the family view. This navigation index is generated from the public snapshot; it is not a modern translation’s full name index. English notes are machine-assisted drafts, and mythological traditions have variants.`:`${people.length} 位人物，${graph.factions.length} 个类别。点击姓名进入图谱并打开人物详情。这是由公开人物快照生成的导航，不是现代译本的专名索引。神话存在异说，资料欢迎附来源纠错。`}</p>${sections}<footer><a href="https://readmap.inklinks.io/">ReadMap${en?' (Chinese)':''}</a> · <a href="https://github.com/adonisly/homeric-epic-map/issues">${en?'Suggest a correction':'资料纠错'}</a> · <a href="${en?'../../':'../'}LICENSE">AGPL-3.0</a></footer></main></body></html>`
    return {head,intro,catalog}
  }
  const zh=localized(false),en=localized(true)
  return {head:zh.head,intro:zh.intro,enHead:en.head,enIntro:en.intro,assets:{'explore/index.html':zh.catalog,'en/explore/index.html':en.catalog,'sitemap.xml':`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['','explore/','en/','en/explore/'].map(p=>`<url><loc>${e(new URL(p,base).href)}</loc></url>`).join('')}</urlset>\n`,'robots.txt':`User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap.xml',base).href}\n`}}
}
