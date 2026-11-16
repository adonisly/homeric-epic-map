// SPDX-License-Identifier: AGPL-3.0-only
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {localizeGraph,translationReport,translatedField,localePaths,relativeRelationLabel} from '../src/i18n/content.mjs'
import {createI18n} from '../src/i18n/index.ts'
import {buildFigureIndex,scoreFigure} from '../src/search.ts'
import {kinshipRole} from '../src/kinship.ts'
import {createSharedUrl,parseSharedView} from '../src/shared-view.mjs'
import {createSiteContent} from '../scripts/site-content.mjs'
const graph=JSON.parse(readFileSync(new URL('../public/data/homeric.json',import.meta.url),'utf8'))
const translations=JSON.parse(readFileSync(new URL('../public/data/locales/en.json',import.meta.url),'utf8'))
test('every nonempty public field has a complete source-matched English translation',()=>{
 const report=translationReport(graph,translations)
 assert.equal(report.missing,0);assert.equal(report.stale,0);assert(report.draft>0)
 assert.equal(Object.keys(translations.figures).length,208)
 for(const group of ['figures','relations','relationTypes'])for(const entry of Object.values(translations[group]))for(const field of Object.values(entry))for(const text of field.text)assert(!/[\u4e00-\u9fff]/.test(text))
})
test('translation preserves source, structural keys, relationships, confidence and excluded content',()=>{
 const before=structuredClone(graph),en=localizeGraph(graph,'en',translations)
 assert.deepEqual(graph,before)
 const keys=['id','name_zh','name_en','faction_id','group_label','generation','gender','war_side','confidence','image_url']
 const structural=p=>Object.fromEntries(keys.map(k=>[k,p[k]]))
 assert.deepEqual(en.figures.map(structural),graph.figures.map(structural))
 assert.deepEqual(en.relations.map(r=>[r.id,r.from_figure_id,r.to_figure_id,r.relation_type,r.confidence]),graph.relations.map(r=>[r.id,r.from_figure_id,r.to_figure_id,r.relation_type,r.confidence]))
 assert.deepEqual(en.nameIndex,[]);assert(en.figures.every(f=>f.image_url===null))
})
test('changed and missing translations explicitly fall back to the Chinese source',()=>{
 const entry={source:['旧原文'],text:['Old source'],review:'draft'}
 assert.deepEqual(translatedField('新原文',entry),{text:['新原文'],status:'stale'})
 const missing=localizeGraph(graph,'en',{}).figures.find(f=>f.id==='zeus')
 assert.equal(missing.translationStatus,'missing')
 assert.equal(missing.domain,graph.figures.find(f=>f.id==='zeus').domain)
})
test('English and Chinese names, source roles and English roles remain searchable in both modes',()=>{
 const original=graph.figures.find(f=>f.id==='zeus')
 for(const locale of ['zh','en']){
  const zeus=localizeGraph(graph,locale,translations).figures.find(f=>f.id==='zeus')
  for(const query of ['Zeus','宙斯','zhousi','zs','thunder',original.domain])assert(scoreFigure(buildFigureIndex(zeus),query)>0,`${locale}: ${query}`)
 }
})
test('English kinship has gender-aware labels and leaves the Chinese default compatible',()=>{
 assert.equal(kinshipRole('female','parent','en'),'Mother')
 assert.equal(kinshipRole('male','child','en'),'Son')
 assert.equal(kinshipRole(null,'grandparent','en'),'Grandparent')
 assert.equal(kinshipRole('female','parent'),'母亲')
 const en=createI18n('en',translations,graph)
 assert.equal(en.name(graph.figures.find(f=>f.id==='zeus')),'Zeus')
 assert.equal(en.t('配偶'),'Spouse');assert.equal(en.generation(3),'Gen 3')
})
test('language switching and sharing preserve only valid category and public view state',()=>{
 const paths=localePaths('/map/en/index.html');assert.equal(paths.base,'/map/');assert.equal(paths.en,'/map/en/')
 const state={view:'tree',mode:'ego',focus:'achilles',figure:'achilles',query:'hero',category:'greek'}
 const ids=graph.figures.map(f=>f.id),factions=graph.factions.map(f=>f.id)
 const en=createSharedUrl('https://example.com'+paths.en+'?token=private#secret',state)
 assert(!en.includes('private'));assert(!en.includes('secret'));assert.deepEqual(parseSharedView(en,ids,factions),state)
 const zh=createSharedUrl('https://example.com'+paths.zh,parseSharedView(en,ids,factions))
 assert.deepEqual(parseSharedView(zh,ids,factions),state)
 assert.equal(parseSharedView(en.replace('category=greek','category=unknown'),ids,factions).category,undefined)
})
test('English index is real HTML with escaped content, self canonical and reciprocal language links',()=>{
 const changed=structuredClone(graph);changed.figures[0].epithet='<script>source</script>'
 const site=createSiteContent(changed,'https://example.com/map/','',translations),html=site.assets['en/explore/index.html']
 assert(html.includes('<html lang="en">'));assert(html.includes('Achilles'));assert(html.includes('&lt;script&gt;source&lt;/script&gt;'))
 assert(!html.includes('<script>source'))
 assert(site.enHead.includes('rel="canonical" href="https://example.com/map/en/"'))
 for(const head of [site.head,site.enHead]){assert(head.includes('hreflang="en"'));assert(head.includes('hreflang="zh-CN"'))}
 assert.equal((site.assets['sitemap.xml'].match(/<loc>/g)||[]).length,4)
 assert(site.enHead.includes('social-preview-en.png'))
})

test('incoming directed relations are not presented as actions by the selected person',()=>{
 assert.equal(relativeRelationLabel('kills','in','en','Kills'),'Killed by')
 assert.equal(relativeRelationLabel('kills','out','en','Kills'),'Kills')
 assert.equal(relativeRelationLabel('kills','in','zh','杀死'),'杀害者')
 assert.equal(relativeRelationLabel('love','in','en','Desire / Abduction'),'Desired / abducted by')
})
