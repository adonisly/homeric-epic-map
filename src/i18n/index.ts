// SPDX-License-Identifier: AGPL-3.0-only
import type { HomericFigure, HomericGraph } from '../types'
import { translatedField } from './content.mjs'
export type Locale = 'zh' | 'en'
export type Translations = Record<string, any>
export const EMPTY_TRANSLATIONS: Translations = Object.freeze({})
const messages:Record<string,string>={
  '荷马史诗脉络图':'Homeric Epic Map',
  '交互式探索荷马史诗中的神祇与英雄 · 神谱 · 特洛伊战争 · 伊利亚特 · 奥德赛':'Explore gods, heroes and family lineages · The Iliad · The Odyssey · The Trojan War',
  '返回首页':'Back to home', '阅读路书 ReadMap':'ReadMap (Chinese)', '阅读路书':'ReadMap', '阅读路径与知识图谱':'Reading paths and knowledge graphs (Chinese)',
  '搜索人物 / 神职 / 称号（中文·拼音·外文名·别名）':'Search names, roles, epithets or aliases…',
  '搜索人物 / 神职 / 称号 / 地名 / 族群 / 物名（中文·拼音·外文名·别名）':'Search names, roles, epithets or aliases…',
  '项目与分享':'Project and sharing','分享当前视图':'Share this view','人物索引':'Character index','纠错反馈':'Suggest a correction','源码 · AGPL-3.0':'Source · AGPL-3.0',
  '分享链接已复制':'Share link copied','请复制下方分享链接':'Select and copy the link below','分享链接':'Share link','人物分享链接':'Character share link','分享此人物':'Share this character','关闭':'Close',
  '阵营关系图':'Factions','神话谱系图':'Genealogy','全景谱系':'Full genealogy','人物谱系':'Family view',
  '创世之神':'Primordial Deities','未知':'Unknown','其他':'Other','无匹配':'No matches','无结果':'No results',
  '焦点':'Focus','同辈':'Same generation','配偶':'Spouse','家系成员':'Family members','直系祖先':'Direct ancestors','焦点一代':'Focus generation','直系后代':'Direct descendants','未定代际':'Unknown generation',
  '父母 → 子女':'Parent → child','兄弟姐妹':'Siblings','本人':'Self',
  '父亲':'Father','母亲':'Mother','父母':'Parents','祖父':'Grandfather','祖母':'Grandmother','祖父母':'Grandparents','曾祖父':'Great-grandfather','曾祖母':'Great-grandmother','曾祖父母':'Great-grandparents','儿子':'Son','女儿':'Daughter','子女':'Children','兄弟':'Brother','姐妹':'Sister','丈夫':'Husband','妻子':'Wife',
  '按已录入血缘展开':'Based on recorded family relationships','别名 / 其他译名：':'Aliases / alternative names: ','罗马名 ':'Roman name: ',
  '神职 / 身份':'Role / domain','简介':'Biography','其他关系':'Other relationships',
  '向上显示曾祖父母、祖父母与父母，向下显示子女；左右表示同辈或配偶。点击关系人可继续查看。':'Ancestors appear above, children below, and siblings or spouses alongside. Select a relative to explore further.',
  '（暂无录入亲属关系）':'No family relationships recorded yet.',
  '清除搜索':'Clear search','别名':'Aliases','最近搜索':'Recent searches','清除搜索历史':'Clear search history','清除':'Clear','热门搜索':'Popular searches','按查询次数排序':'Ordered by search count','来源：':'Source:',
  '关闭专名释义':'Close name-index entry','快速定位':'Jump to section','阵营关系图区块导航':'Faction map sections','人物类别颜色图例':'Character category colours',
  '缩小视图':'Zoom out','缩小':'Zoom out','放大视图':'Zoom in','放大':'Zoom in','恢复到 100%':'Reset to 100%','重置':'Reset',
  '倾向希腊的神':'Gods supporting the Greeks','倾向特洛伊的神':'Gods supporting the Trojans','中立 / 摇摆 / 命运':'Neutral, shifting or fateful powers','助希腊':'Greek allies','助特洛伊':'Trojan allies','中立':'Neutral','希腊联军 · 阿凯亚人':'Greek coalition · Achaeans','特洛伊及其盟军':'Troy and its allies','奥德赛世界 · 伊塔卡与归乡':'The Odyssey · Ithaca and the journey home','希腊':'Greeks','特洛伊':'Trojans','奥德赛':'Odyssey',
  '助希腊神':'Pro-Greek gods','助特洛伊神':'Pro-Trojan gods','中立神':'Neutral gods','希腊联军':'Greek coalition','特洛伊阵营':'Trojan forces',
  '类别':'Category','按人物类别筛选焦点':'Filter focus by character category','选择焦点人物':'Choose focus character','恢复到全部类别、宙斯焦点':'Reset to all categories and Zeus','恢复默认':'Reset focus','从最早祖先到焦点人物的血缘主链':'Recorded ancestry path to the focus character','血缘主链':'Ancestry path','最早已录入祖先':'Earliest recorded ancestor','起源':'Origin','返回':'Back',
  '人物':'Characters','神祇与神话生灵':'Deities and mythical beings','地名':'Places','族群':'Peoples','物名':'Objects','别名与称号':'Aliases and epithets','同名多义':'Ambiguous names',
}
export function createI18n(locale:Locale, translations:Translations, graph:HomericGraph) {
  const en=locale==='en'
  const labels=new Map<string,string>()
  for(const f of graph.figures)if(f.group_label){const field=translatedField(f.group_label,translations.figures?.[f.id]?.group_label);if(field.status!=='missing'&&field.status!=='stale')labels.set(f.group_label,field.text[0])}
  const t=(key:string)=>en?(messages[key]||labels.get(key)||key):key
  const name=(figure:HomericFigure|undefined)=>figure?(en?(figure.name_en||figure.name_zh):figure.name_zh):''
  const secondary=(figure:HomericFigure)=>en?figure.name_zh:(figure.name_en||'')
  const generation=(value:number|null)=>value==null?t('未定代际'):en?`Gen ${value}`:`第${value}代`
  const hotTerm=(term:string)=>en?name(graph.figures.find(f=>f.name_zh===term))||t(term):term
  return {en,t,name,secondary,generation,hotTerm}
}
