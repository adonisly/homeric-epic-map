// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// 荷马史诗 · 分类配色（Tailwind 固定品牌色）
// -----------------------------------------------------------------------------
// 与站点其他知识图谱(西方哲学史)统一色系:采用鲜亮的 Tailwind 500/600 级别 hex,
// 直接用于 inline style 背景(实色标签)与 SVG stroke(关系连线)。
//   • 阵营:两极战争用 blue(希腊)/red(特洛伊)最醒目,其余按语义分配到不同色相。
//   • 关系:血缘/婚配=暖(琥珀/玫瑰/品红),同盟/挚友=绿,敌对/杀死=红。
//   • 仅浅色主题(dark 档保留同值,当前不启用)。冗余编码仍在(虚线/箭头/文字标签)。
// =============================================================================

export type ColorSet = Record<string, string>

// ---- 阵营主色（9 个 · Tailwind 500 级,与西方哲学史流派色同档）----------------
export const FACTION_COLORS: { light: ColorSet; dark: ColorSet } = {
  light: {
    greek: '#3b82f6', // 希腊联军 · blue-500（战争一极，同柏拉图学派蓝）
    trojan: '#ef4444', // 特洛伊阵营 · red-500（战争另一极，同米利都学派红）
    olympian: '#f59e0b', // 奥林匹斯神 · amber-500（青铜金）
    titan: '#a855f7', // 泰坦神族 · purple-500（茄紫）
    primordial: '#64748b', // 原初神 · slate-500（近中性，最古老）
    sea: '#06b6d4', // 海洋神系 · cyan-500（青碧）
    underworld: '#6b7280', // 冥界与怪物 · gray-500（幽冥中性）
    hero: '#22c55e', // 英雄与家族 · green-500
    odyssey: '#14b8a6', // 奥德赛世界 · teal-500（月桂绿，同亚里士多德学派）
  },
  dark: {
    greek: '#3b82f6',
    trojan: '#ef4444',
    olympian: '#f59e0b',
    titan: '#a855f7',
    primordial: '#64748b',
    sea: '#06b6d4',
    underworld: '#6b7280',
    hero: '#22c55e',
    odyssey: '#14b8a6',
  },
}

// ---- 关系类型色（8 种 · Tailwind 语义色）------------------------------------
// 冗余编码（不靠单一色相）：方向性关系(parent/kills/love)画箭头；冲突关系画虚线,
// enemy(长划) 与 kills(点线) 彼此可区分。
export const RELATION_COLORS: { light: ColorSet; dark: ColorSet } = {
  light: {
    parent: '#f59e0b', // 父/母 · amber-500（血脉，有向）
    spouse: '#f43f5e', // 结合/配偶 · rose-500
    love: '#ec4899', // 爱慕/掠夺 · pink-500（有向）
    sibling: '#3b82f6', // 兄弟姐妹 · blue-500
    ally: '#22c55e', // 盟友/支持 · green-500
    friend: '#10b981', // 挚友 · emerald-500
    enemy: '#ef4444', // 敌对 · red-500（长划虚线）
    kills: '#b91c1c', // 杀死 · red-700（点线 + 箭头，明度与 enemy 分离）
  },
  dark: {
    parent: '#f59e0b',
    spouse: '#f43f5e',
    love: '#ec4899',
    sibling: '#3b82f6',
    ally: '#22c55e',
    friend: '#10b981',
    enemy: '#ef4444',
    kills: '#b91c1c',
  },
}

const NEUTRAL_FALLBACK = { light: '#94a3b8', dark: '#94a3b8' }

type Theme = 'light' | 'dark'

/** 阵营色：优先精修谱系，未知 id 回落到中性石色。 */
export function factionColor(id: string | null | undefined, theme: Theme): string {
  const set = FACTION_COLORS[theme]
  return (id && set[id]) || NEUTRAL_FALLBACK[theme]
}

/** 关系色：优先精修谱系，未知类型回落到中性石色。 */
export function relationColor(value: string | null | undefined, theme: Theme): string {
  const set = RELATION_COLORS[theme]
  return (value && set[value]) || NEUTRAL_FALLBACK[theme]
}
