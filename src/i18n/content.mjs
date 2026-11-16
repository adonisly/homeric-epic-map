// SPDX-License-Identifier: AGPL-3.0-only
export const figureFields = ['aliases','group_label','domain','epithet','bio','variant_note','tags']
export function textArray(value) { return Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? [value] : [] }
/** @param {any} source @param {any} entry */
export function translatedField(source, entry) {
  const original = textArray(source)
  if (!original.length) return {text:original,status:'empty'}
  if (!entry || JSON.stringify(entry.source)!==JSON.stringify(original) || !Array.isArray(entry.text) || entry.text.length!==original.length || entry.text.some((x,i)=>typeof x!=='string'||(original[i].trim()&&!x.trim()))) return {text:original,status:entry?'stale':'missing'}
  return {text:entry.text,status:entry.review==='reviewed'?'reviewed':'draft'}
}
/** @param {any} graph @param {any} translations */
export function translationReport(graph, translations) {
  const result={fields:0,draft:0,reviewed:0,missing:0,stale:0}
  for (const group of ['figures','relations','relationTypes']) for (const row of graph[group]) {
    for (const field of group==='figures'?figureFields:['description','variant_note']) {
      const value=translatedField(row[field],translations?.[group]?.[row.id]?.[field])
      if(value.status==='empty')continue
      result.fields++; result[value.status]++
    }
  }
  return result
}
/** Return display content without changing IDs, faction keys, generations, ordering keys or relationship endpoints.
 * @param {any} graph @param {'zh'|'en'} locale @param {any} translations */
export function localizeGraph(graph, locale='zh', translations={}) {
  const figures=graph.figures.map(row=>{
    const output={...row}, statuses=[]
    const translated=Object.fromEntries(figureFields.map(field=>[field,translatedField(row[field],translations.figures?.[row.id]?.[field])]))
    output.searchAliases=[...textArray(row.aliases),...translated.aliases.text]
    output.searchTerms=[...figureFields.flatMap(field=>textArray(row[field])),...Object.values(translated).flatMap(field=>field.text)]
    if(locale==='en') for(const field of figureFields) {
      const value=translated[field]
      if(value.status!=='empty')statuses.push(value.status)
      // Keep grouping keys unchanged. Translate group headings at presentation time.
      if(field!=='group_label')output[field]=Array.isArray(row[field])?value.text:row[field]==null?row[field]:value.text[0]||''
    }
    output.translationStatus=statuses.includes('stale')?'stale':statuses.includes('missing')?'missing':statuses.includes('draft')?'draft':'reviewed'
    return output
  })
  const relations=graph.relations.map(row=>{
    if(locale!=='en')return row
    const output={...row}
    for(const field of ['description','variant_note'])if(row[field])output[field]=translatedField(row[field],translations.relations?.[row.id]?.[field]).text[0]
    return output
  })
  return {...graph,figures,relations}
}
export function localePaths(pathname) {
  const clean=pathname.replace(/index\.html$/,'')
  const english=/\/en\/?$/.test(clean)
  let base=english?clean.replace(/en\/?$/,''):clean
  if(!base.endsWith('/'))base+='/'
  return {locale:english?'en':'zh',base,zh:base,en:base+'en/'}
}
/** Labels in a person's detail panel are relative to that person, not always the edge source. */
export function relativeRelationLabel(kind, direction, locale, fallback) {
  if(direction==='in'&&kind==='kills')return locale==='en'?'Killed by':'杀害者'
  if(direction==='in'&&kind==='love')return locale==='en'?'Desired / abducted by':'爱慕／掠夺者'
  return fallback
}
/** @param {any} faction */
export function factionName(faction,locale='zh') {
  if(!faction)return locale==='en'?'Unknown':'未知'
  if(locale!=='en')return faction.id==='primordial'?'创世之神':faction.name_zh
  const labels={primordial:'Primordial Deities',titan:'Titans',olympian:'Olympians',sea:'Sea Deities',underworld:'Underworld & Monsters',greek:'Greek Coalition',trojan:'Trojan Forces',hero:'Heroes & Families',odyssey:'World of the Odyssey'}
  return labels[faction.id]||faction.name_en||faction.name_zh
}
