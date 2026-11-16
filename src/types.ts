// SPDX-License-Identifier: AGPL-3.0-only
// 荷马史诗人物关系图类型。独立于 lib/types/knowledge-graph.ts(绝不改后者,防回归哲学/音乐图)。

export type HomericConfidence = 'standard' | 'variant' | 'disputed'
export type WarSide = 'greek' | 'trojan' | 'neutral'
export type HomericGender = 'male' | 'female' | 'unknown'

export interface HomericFaction {
  id: string
  name_zh: string
  name_en: string | null
  color: string
  sort_order: number | null
  in_legend: boolean
}

export interface HomericFigure {
  searchAliases?: string[]
  searchTerms?: string[]
  translationStatus?: string
  id: string
  name_zh: string
  name_en: string | null
  name_roman: string | null
  gender: HomericGender
  py: string | null
  aliases: string[] | null
  faction_id: string | null
  war_side: WarSide | null
  group_label: string | null
  generation: number | null
  domain: string | null
  epithet: string | null
  bio: string[] | null
  image_url: string | null
  confidence: HomericConfidence
  variant_note: string | null
  tags: string[] | null
}

export interface HomericRelation {
  id: number
  from_figure_id: string
  to_figure_id: string
  relation_type: string
  description: string | null
  confidence: HomericConfidence
  variant_note: string | null
}

export interface HomericRelationType {
  id: number
  value: string
  label_zh: string
  label_en: string | null
  color: string
  is_directional: boolean
  description: string | null
}

export type HomericNameIndexCategory =
  | 'person'
  | 'deity'
  | 'place'
  | 'people'
  | 'object'
  | 'alias'
  | 'mixed'
  | 'other'

export interface HomericNameIndexEntry {
  id: string
  section: string
  sort_order: number
  name_zh: string
  name_en: string | null
  category: HomericNameIndexCategory
  description: string
  raw_entry: string
  linked_figure_ids: string[]
  source_label: string
}

// 完整图谱数据；公开入口读取静态快照，宿主也可注入自己的读取适配。
export interface HomericGraph {
  factions: HomericFaction[]
  figures: HomericFigure[]
  relations: HomericRelation[]
  relationTypes: HomericRelationType[]
  nameIndex: HomericNameIndexEntry[]
}
