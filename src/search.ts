// SPDX-License-Identifier: AGPL-3.0-only
// 荷马史诗搜索:支持中文名全拼 / 首字母 / 子串,以及英文名·罗马名·别名·神职·简介的模糊匹配。
// 希腊神话中文名多为标准音译汉字,pinyin-pro 自动转拼音效果良好(区别于佛教专名,无需手写 py)。
// 不复用 KnowledgeEntity 相关搜索,仅沿用 music-search 的打分思路。
import { pinyin } from 'pinyin-pro'
import type { HomericFigure, HomericNameIndexEntry } from './types'

export interface TextIndex {
  original: string
  fullPinyin: string
  firstLetters: string
}

// 为一段文本生成搜索索引(原文 / 全拼 / 首字母)
export function generateSearchIndex(text: string): TextIndex {
  const original = (text || '').toLowerCase().trim()
  try {
    const fullPinyin = pinyin(text, { toneType: 'none', type: 'array' }).join('').toLowerCase()
    const firstLetters = pinyin(text, { pattern: 'first', toneType: 'none' }).toLowerCase().replace(/\s/g, '')
    return { original, fullPinyin, firstLetters }
  } catch {
    return { original, fullPinyin: original, firstLetters: original }
  }
}

// 对单个文本索引打分(0 = 不匹配)
export function calculateMatchScore(query: string, index: TextIndex): number {
  const q = query.toLowerCase().trim()
  if (!q) return 0
  if (index.original === q) return 100
  if (index.original.startsWith(q)) return 90
  const containsIndex = index.original.indexOf(q)
  if (containsIndex !== -1) return 80 - containsIndex * 0.5
  if (index.fullPinyin === q) return 70
  if (index.fullPinyin.startsWith(q)) return 60
  if (index.fullPinyin.includes(q)) return 50
  if (index.firstLetters === q) return 40
  if (index.firstLetters.startsWith(q)) return 30
  if (index.firstLetters.includes(q)) return 20
  return 0
}

export interface FigureSearchIndex {
  id: string
  // 名称类字段(中文名/英文名/罗马名/手写py/别名)都建拼音索引
  nameIndexes: TextIndex[]
  // 内容类字段逐项建索引，避免长文本拼接后全拼边界失真。
  // 因此“丰收女神 / fengshounvshen / fsns”均能命中神职或称号。
  contentIndexes: TextIndex[]
}

export function buildFigureIndex(f: HomericFigure): FigureSearchIndex {
  const names = [f.name_zh, f.name_en, f.name_roman, f.py, ...(f.aliases || []), ...(f.searchAliases || [])].filter(Boolean) as string[]
  const content = [f.domain, f.epithet, f.group_label, ...(f.bio || []), ...(f.tags || []), ...(f.searchTerms || [])]
    .filter(Boolean) as string[]
  return {
    id: f.id,
    nameIndexes: names.map(generateSearchIndex),
    contentIndexes: content.map(generateSearchIndex),
  }
}

// 一次性为整张图建索引(供组件 useMemo 缓存)
export function buildIndexMap(figures: HomericFigure[]): Map<string, FigureSearchIndex> {
  return new Map(figures.map((f) => [f.id, buildFigureIndex(f)]))
}

// 对某人物打分:名称优先；神职/称号/简介也支持原文、拼音和首字母，
// 但将内容分限制在 55 以下，确保同名人物始终排在关键词命中之前。
export function scoreFigure(idx: FigureSearchIndex | undefined, query: string): number {
  if (!idx) return 0
  const q = query.toLowerCase().trim()
  if (!q) return 0
  let best = 0
  for (const ni of idx.nameIndexes) best = Math.max(best, calculateMatchScore(q, ni))
  for (const ci of idx.contentIndexes) {
    const contentScore = calculateMatchScore(q, ci)
    if (contentScore > 0) best = Math.max(best, Math.min(55, contentScore * 0.55))
  }
  return best
}

export interface NameEntrySearchIndex {
  id: string
  nameIndexes: TextIndex[]
  contentIndexes: TextIndex[]
}

export function buildNameEntryIndex(entry: HomericNameIndexEntry): NameEntrySearchIndex {
  return {
    id: entry.id,
    nameIndexes: [entry.name_zh, entry.name_en].filter(Boolean).map((value) =>
      generateSearchIndex(value as string),
    ),
    contentIndexes: [entry.description, entry.raw_entry]
      .filter(Boolean)
      .map(generateSearchIndex),
  }
}

export function buildNameIndexMap(
  entries: HomericNameIndexEntry[],
): Map<string, NameEntrySearchIndex> {
  return new Map(entries.map((entry) => [entry.id, buildNameEntryIndex(entry)]))
}

export function scoreNameEntry(
  idx: NameEntrySearchIndex | undefined,
  query: string,
): number {
  if (!idx) return 0
  const q = query.toLowerCase().trim()
  if (!q) return 0
  let best = 0
  for (const name of idx.nameIndexes) {
    best = Math.max(best, calculateMatchScore(q, name))
  }
  for (const content of idx.contentIndexes) {
    const contentScore = calculateMatchScore(q, content)
    if (contentScore > 0) best = Math.max(best, Math.min(55, contentScore * 0.55))
  }
  return best
}
