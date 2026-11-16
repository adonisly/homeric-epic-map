// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSharedUrl, parseSharedView } from './shared-view.mjs'
import type {
  HomericGraph as HomericGraphData,
  HomericFigure,
  HomericNameIndexEntry,
} from './types'
import {
  buildIndexMap,
  buildNameIndexMap,
  scoreFigure,
  scoreNameEntry,
} from './search'
import { factionColor, relationColor } from './palette'
import { createI18n, EMPTY_TRANSLATIONS, type Locale, type Translations } from './i18n'
import { localizeGraph, relativeRelationLabel, factionName } from './i18n/content.mjs'
import { kinshipRole } from './kinship'
import {
  Home,
  Landmark,
  Search,
  X,
  Swords,
  Network,
  Undo2,
  RotateCcw,
  Navigation,
  Palette,
  Users,
  ZoomIn,
  ZoomOut,
  Clock3,
  TrendingUp,
  Trash2,
} from 'lucide-react'

const GOD_FACTIONS = ['olympian', 'primordial', 'titan', 'sea', 'underworld']
const KINSHIP_RELATIONS = new Set(['parent', 'spouse', 'sibling'])
const HOMERIC_SEARCH_HISTORY_KEY = 'homeric-epic-search-history'
const MAX_SEARCH_HISTORY = 8
const NAME_INDEX_CATEGORY_LABELS: Record<HomericNameIndexEntry['category'], string> = {
  person: '人物',
  deity: '神祇与神话生灵',
  place: '地名',
  people: '族群',
  object: '物名',
  alias: '别名与称号',
  mixed: '同名多义',
  other: '其他',
}

interface HotSearchTerm {
  term: string
  count: number
}

function readSearchHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const value = JSON.parse(window.localStorage.getItem(HOMERIC_SEARCH_HISTORY_KEY) || '[]')
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .slice(0, MAX_SEARCH_HISTORY)
      : []
  } catch {
    return []
  }
}

function addSearchHistory(term: string): string[] {
  const normalized = term.trim().slice(0, 100)
  if (!normalized || typeof window === 'undefined') return readSearchHistory()
  const lower = normalized.toLocaleLowerCase()
  const next = [
    normalized,
    ...readSearchHistory().filter((item) => item.toLocaleLowerCase() !== lower),
  ].slice(0, MAX_SEARCH_HISTORY)
  window.localStorage.setItem(HOMERIC_SEARCH_HISTORY_KEY, JSON.stringify(next))
  return next
}

interface EdgePath {
  d: string
  color: string
  label: string
  labelX: number
  labelY: number
  // 父母→子女保留箭头，配偶和兄弟姐妹为无方向关系。
  directional: boolean
}

interface TreeEdgePath {
  d: string
  hot: boolean
  label: string
  labelX: number
  labelY: number
  dash?: string
}

export interface HomericGraphProps {
  graph: HomericGraphData
  locale?: Locale
  translations?: Translations
  onLocaleChange?: (locale: Locale, state: ReturnType<typeof parseSharedView>) => void
  backHref?: string
  backLabel?: string
  sourceHref?: string
  catalogHref?: string
  feedbackHref?: string
  searchPlaceholder?: string
  loadHotSearches?: () => Promise<HotSearchTerm[]>
  trackSearch?: (term: string) => Promise<boolean>
}

export function HomericGraph({ graph: sourceGraph, locale = 'zh', translations = EMPTY_TRANSLATIONS, onLocaleChange, backHref, backLabel = '返回首页', sourceHref, catalogHref, feedbackHref, searchPlaceholder = '搜索人物 / 神职 / 称号 / 地名 / 族群 / 物名（中文·拼音·外文名·别名）', loadHotSearches, trackSearch }: HomericGraphProps) {
  const { en, t, name, secondary, generation, hotTerm } = useMemo(() => createI18n(locale, translations, sourceGraph), [locale, translations, sourceGraph.figures])
  const graph: HomericGraphData = useMemo(() => localizeGraph(sourceGraph, locale, translations), [sourceGraph.figures, sourceGraph.relations, sourceGraph.factions, sourceGraph.relationTypes, sourceGraph.nameIndex, locale, translations])
  const { factions, figures, relations, relationTypes, nameIndex } = graph

  // ---------- lookups ----------
  const byId = useMemo(
    () => Object.fromEntries(figures.map((f) => [f.id, f])) as Record<string, HomericFigure>,
    [figures],
  )
  const facById = useMemo(() => Object.fromEntries(factions.map((f) => [f.id, f])), [factions])
  const facLabel = useCallback(
    (id: string | null) => {
      return factionName(id ? facById[id] : undefined, locale)
    },
    [facById, locale],
  )
  const relTypeByValue = useMemo(
    () => Object.fromEntries(relationTypes.map((t) => [t.value, t])),
    [relationTypes],
  )
  const relLabel = useCallback(
    (v: string) => (en ? (v === 'love' ? 'Desire / Abduction' : relTypeByValue[v]?.label_en) : relTypeByValue[v]?.label_zh) || v,
    [relTypeByValue, en],
  )

  // ---------- state ----------
  const [query, setQuery] = useState('')
  const [locatedId, setLocatedId] = useState<string | null>(null)
  const [pendingDrawerId, setPendingDrawerId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const [selectedNameEntry, setSelectedNameEntry] = useState<HomericNameIndexEntry | null>(null)
  const [pinnedRelationId, setPinnedRelationId] = useState<string | null>(null)
  const [view, setView] = useState<'war' | 'tree'>('tree')
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [hotSearches, setHotSearches] = useState<HotSearchTerm[]>([])
  const [shareStatus, setShareStatus] = useState('')
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const headerRef = useRef<HTMLElement>(null)
  // 仅保留浅色主题(已移除深色切换)
  const theme = 'light' as const

  // 人物谱系默认以宙斯为焦点，避免与全景谱系重复展示同一张全图。
  const [focusId, setFocusId] = useState<string>('zeus')
  const [focusFactionId, setFocusFactionId] = useState<string>('')
  const [famHist, setFamHist] = useState<string[]>([])
  // 神话谱系图默认进入人物谱系。
  const [treeMode, setTreeMode] = useState<'layers' | 'ego'>('ego')
  useEffect(() => {
    const state = parseSharedView(window.location.href, figures.map(figure => figure.id), factions.map(faction => faction.id))
    setView(state.view)
    setTreeMode(state.mode)
    setFocusId(state.focus || 'zeus')
    setSelectedId(state.figure)
    setQuery(state.query)
    setFocusFactionId(state.category || '')
  }, [figures])

  useEffect(() => {
    if (!selectedId) return
    const previousFocus = document.activeElement as HTMLElement | null
    const frame = window.requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>('button')?.focus())
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setSelectedId(null) }
      if (event.key !== 'Tab') return
      const elements = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, [tabindex="0"]') || [])
      const first = elements[0], last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener('keydown', onKey); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }) }
  }, [selectedId])

  const switchLanguage = () => onLocaleChange?.(en ? 'zh' : 'en', {view, mode: treeMode, focus: focusId, figure: selectedId, query, category: focusFactionId})

  const shareView = async () => {
    const url = createSharedUrl(window.location.href, { view, mode: treeMode, focus: focusId, figure: selectedId, query, category: focusFactionId })
    try {
      await navigator.clipboard.writeText(url)
      setShareStatus(t('分享链接已复制'))
    } catch {
      setShareStatus(t('请复制下方分享链接'))
    }
    setShareUrl(url)
  }
  const [shareUrl, setShareUrl] = useState('')
  const [zoomByView, setZoomByView] = useState({
    war: 1,
    layers: 1,
    ego: 1,
  })
  const relationGraphRef = useRef<HTMLDivElement>(null)

  const zoomKey = view === 'war' ? 'war' : treeMode
  const activeZoom = zoomByView[zoomKey]
  const zoomViewLabel =
    t(view === 'war' ? '阵营关系图' : treeMode === 'layers' ? '全景谱系' : '人物谱系')
  const changeZoom = (delta: number) => {
    setZoomByView((current) => ({
      ...current,
      [zoomKey]: Math.min(1.5, Math.max(0.7, Math.round((current[zoomKey] + delta) * 10) / 10)),
    }))
  }
  const resetZoom = () => {
    setZoomByView((current) => ({ ...current, [zoomKey]: 1 }))
  }
  const zoomSurfaceStyle = {
    '--hg-zoom': String(activeZoom),
  } as React.CSSProperties

  // ---------- categorical colors (Tailwind 分类色,见 ./palette) ----------
  const facColor = useCallback((id: string | null) => factionColor(id, theme), [theme])
  const relColor = useCallback((v: string) => relationColor(v, theme), [theme])

  // 标签样式:实色底 + 白字(对齐西方哲学史卡片的流派标签)。用于卡片神职标签、阵营徽标、抽屉阵营 tag。
  const chipStyle = useCallback(
    (col: string): React.CSSProperties => ({
      background: col,
      color: '#fff',
      borderColor: col,
    }),
    [],
  )

  // ---------- relation helpers ----------
  const relOf = useCallback(
    (id: string) => {
      const out: { other: string; kind: string; dir: 'out' | 'in' }[] = []
      relations.forEach((r) => {
        if (r.from_figure_id === id) out.push({ other: r.to_figure_id, kind: r.relation_type, dir: 'out' })
        if (r.to_figure_id === id) out.push({ other: r.from_figure_id, kind: r.relation_type, dir: 'in' })
      })
      return out
    },
    [relations],
  )
  const kinRelOf = useCallback(
    (id: string) => relOf(id).filter((relation) => KINSHIP_RELATIONS.has(relation.kind)),
    [relOf],
  )
  const parentsOf = useCallback(
    (id: string) => relations.filter((r) => r.relation_type === 'parent' && r.to_figure_id === id).map((r) => r.from_figure_id),
    [relations],
  )
  const childrenOf = useCallback(
    (id: string) => relations.filter((r) => r.relation_type === 'parent' && r.from_figure_id === id).map((r) => r.to_figure_id),
    [relations],
  )
  const partnersOf = useCallback(
    (id: string) => {
      const s = new Set<string>()
      relations.forEach((r) => {
        if (r.relation_type === 'spouse' || r.relation_type === 'love') {
          if (r.from_figure_id === id) s.add(r.to_figure_id)
          if (r.to_figure_id === id) s.add(r.from_figure_id)
        }
      })
      childrenOf(id).forEach((kid) => parentsOf(kid).forEach((p) => { if (p !== id) s.add(p) }))
      return [...s]
    },
    [relations, childrenOf, parentsOf],
  )

  // 与详情关系图保持同一范围：直接亲属 + 向上三代祖先。
  // 不沿神祇祖先继续遍历其所有旁支，避免波塞冬等节点把多个家系全部点亮。
  const lineageNeighborhood = useCallback(
    (id: string) => {
      const related = new Set<string>([id])
      kinRelOf(id).forEach((relation) => related.add(relation.other))
      let generation = [id]
      for (let depth = 0; depth < 3; depth += 1) {
        generation = [...new Set(generation.flatMap((figureId) => parentsOf(figureId)))]
        generation.forEach((figureId) => related.add(figureId))
      }
      return related
    },
    [kinRelOf, parentsOf],
  )

  // ---------- 规范代际(基于 parent 边计算,不信任 DB generation) ----------
  // 模型:双向下界不动点。对每条 parent 边 p→c 保证 gen(c) ≥ max(gen(p))+1;
  // 同时把「只有下游、无父母」的 root 用 gen(root) ≥ min(gen(子女))-1 拉到子女上一行,
  // 使 metis/peleus/leda 等缺记载父母的配偶落到与其伴侣同代,而混沌(唯一真正的顶层 root)稳居第 1 代。
  const { genById, facRankById } = useMemo(() => {
    const ids = figures.map((f) => f.id)
    const idSet = new Set(ids)
    const parents = new Map<string, string[]>()
    const children = new Map<string, string[]>()
    ids.forEach((id) => {
      parents.set(id, [])
      children.set(id, [])
    })
    relations.forEach((r) => {
      if (r.relation_type !== 'parent') return
      if (!idSet.has(r.from_figure_id) || !idSet.has(r.to_figure_id)) return
      children.get(r.from_figure_id)!.push(r.to_figure_id)
      parents.get(r.to_figure_id)!.push(r.from_figure_id)
    })
    const hasEdge = (id: string) => parents.get(id)!.length > 0 || children.get(id)!.length > 0
    const CAP = ids.length + 2 // 环防御上限

    const depth = new Map<string, number>()
    ids.forEach((id) => {
      if (hasEdge(id)) depth.set(id, 1)
    })
    for (let iter = 0; iter <= CAP; iter++) {
      let changed = false
      depth.forEach((cur, id) => {
        let val = 1
        for (const p of parents.get(id)!) {
          const dp = depth.get(p)
          if (dp !== undefined) val = Math.max(val, dp + 1)
        }
        let minChild = Infinity
        for (const c of children.get(id)!) {
          const dc = depth.get(c)
          if (dc !== undefined && dc < minChild) minChild = dc
        }
        if (minChild !== Infinity) val = Math.max(val, minChild - 1)
        if (val > CAP) val = CAP
        if (val !== cur) {
          depth.set(id, val)
          changed = true
        }
      })
      if (!changed) break
    }

    // 无向连通分量(仅 parent 边):定位「混沌所在的主家系树」
    const adj = new Map<string, string[]>()
    ids.forEach((id) => adj.set(id, []))
    relations.forEach((r) => {
      if (r.relation_type !== 'parent') return
      if (!idSet.has(r.from_figure_id) || !idSet.has(r.to_figure_id)) return
      adj.get(r.from_figure_id)!.push(r.to_figure_id)
      adj.get(r.to_figure_id)!.push(r.from_figure_id)
    })
    const compOf = new Map<string, number>()
    const comps: string[][] = []
    ids.forEach((id) => {
      if (!hasEdge(id) || compOf.has(id)) return
      const comp: string[] = []
      const stack = [id]
      compOf.set(id, comps.length)
      while (stack.length) {
        const x = stack.pop()!
        comp.push(x)
        for (const y of adj.get(x)!)
          if (!compOf.has(y)) {
            compOf.set(y, comps.length)
            stack.push(y)
          }
      }
      comps.push(comp)
    })
    const chaosComp = compOf.get('chaos')

    // 断链家系簇(伊塔卡/特洛伊王室/费阿刻斯等,与混沌无 parent 连通):
    // 仅用 DB generation 作「粗略纵向锚」整体下沉,避免它们的局部 root 冒到神系顶端;
    // 簇内相对次序仍由 parent 边决定(不用 DB generation 排代际)。
    const dbBand = (g: number | null | undefined) =>
      g == null ? 6 : (({ 0: 1, 1: 3, 2: 5, 3: 8 } as Record<number, number>)[g] ?? 6)
    comps.forEach((comp, ci) => {
      if (ci === chaosComp) return
      let localMin = Infinity
      let hintTop = Infinity
      comp.forEach((id) => {
        const d = depth.get(id)!
        if (d < localMin) localMin = d
        const h = dbBand(byId[id]?.generation)
        if (h < hintTop) hintTop = h
      })
      const offset = hintTop - localMin
      if (offset) comp.forEach((id) => depth.set(id, depth.get(id)! + offset))
    })

    const genById: Record<string, number | null> = {}
    ids.forEach((id) => {
      genById[id] = depth.has(id) ? depth.get(id)! : null
    })

    // 孤立节点(无 parent 边、也非任何人父母):按同 faction 已算成员的众数代际兜底
    const facCount = new Map<string, Map<number, number>>()
    ids.forEach((id) => {
      const g = genById[id]
      const fac = byId[id]?.faction_id
      if (g == null || !fac) return
      if (!facCount.has(fac)) facCount.set(fac, new Map())
      const m = facCount.get(fac)!
      m.set(g, (m.get(g) ?? 0) + 1)
    })
    const facMode = new Map<string, number>()
    facCount.forEach((m, fac) => {
      let best = -1
      let bestG = 0
      m.forEach((cnt, g) => {
        if (cnt > best || (cnt === best && g < bestG)) {
          best = cnt
          bestG = g
        }
      })
      facMode.set(fac, bestG)
    })
    ids.forEach((id) => {
      if (genById[id] != null) return
      const fac = byId[id]?.faction_id
      if (fac && facMode.has(fac)) genById[id] = facMode.get(fac)!
    })

    // 神族·第几代:各 faction 内出现过的规范代际升序去重后的名次
    const facRankById: Record<string, number | null> = {}
    const facVals = new Map<string, Set<number>>()
    ids.forEach((id) => {
      const g = genById[id]
      const fac = byId[id]?.faction_id
      if (g == null || !fac) return
      if (!facVals.has(fac)) facVals.set(fac, new Set())
      facVals.get(fac)!.add(g)
    })
    const facRankMap = new Map<string, Map<number, number>>()
    facVals.forEach((set, fac) => {
      const rm = new Map<number, number>()
      ;[...set].sort((a, b) => a - b).forEach((g, i) => rm.set(g, i + 1))
      facRankMap.set(fac, rm)
    })
    ids.forEach((id) => {
      const g = genById[id]
      const fac = byId[id]?.faction_id
      facRankById[id] = g != null && fac ? facRankMap.get(fac)?.get(g) ?? null : null
    })

    return { genById, facRankById }
  }, [figures, relations, byId])

  const genOf = useCallback((id: string) => genById[id] ?? null, [genById])
  const facRankOf = useCallback((id: string) => facRankById[id] ?? null, [facRankById])

  // ---------- search index (拼音/首字母/子串) ----------
  const searchIndex = useMemo(() => buildIndexMap(figures), [figures])
  const properNameSearchIndex = useMemo(() => buildNameIndexMap(nameIndex), [nameIndex])

  // ---------- matches / grouping ----------
  const matches = useCallback(
    (c: HomericFigure) => {
      if (!query) return true
      return scoreFigure(searchIndex.get(c.id), query) > 0
    },
    [query, searchIndex],
  )

  const groups = useMemo(() => {
    const isGod = (c: HomericFigure) => !!c.faction_id && GOD_FACTIONS.includes(c.faction_id)
    const gods = figures.filter(isGod)
    return {
      greekGods: gods.filter((c) => c.war_side === 'greek'),
      neutralGods: gods.filter((c) => !c.war_side || c.war_side === 'neutral'),
      trojanGods: gods.filter((c) => c.war_side === 'trojan'),
      greekHeroes: figures.filter((c) => ['greek', 'hero'].includes(c.faction_id || '') && c.war_side !== 'trojan'),
      trojanHeroes: figures.filter(
        (c) => c.faction_id === 'trojan' || (['greek', 'hero'].includes(c.faction_id || '') && c.war_side === 'trojan'),
      ),
      odyssey: figures.filter((c) => c.faction_id === 'odyssey'),
    }
  }, [figures])

  const facCounts = useMemo(() => {
    const m: Record<string, number> = {}
    figures.forEach((c) => { if (c.faction_id) m[c.faction_id] = (m[c.faction_id] || 0) + 1 })
    return m
  }, [figures])

  const sectionNavItems = useMemo(
    () =>
      [
        { id: 'war-greek-gods', label: '助希腊神', list: groups.greekGods },
        { id: 'war-trojan-gods', label: '助特洛伊神', list: groups.trojanGods },
        { id: 'war-neutral-gods', label: '中立神', list: groups.neutralGods },
        { id: 'war-greek-heroes', label: '希腊联军', list: groups.greekHeroes },
        { id: 'war-trojan-heroes', label: '特洛伊阵营', list: groups.trojanHeroes },
        { id: 'war-odyssey', label: '奥德赛', list: groups.odyssey },
      ].map((item) => ({
        ...item,
        total: item.list.length,
        visible: item.list.filter(matches).length,
      })),
    [groups, matches],
  )

  const warFigureCounts = useMemo(() => {
    const all = new Set<string>()
    const visible = new Set<string>()
    sectionNavItems.forEach((item) => {
      item.list.forEach((figure) => {
        all.add(figure.id)
        if (matches(figure)) visible.add(figure.id)
      })
    })
    return { total: all.size, visible: visible.size }
  }, [sectionNavItems, matches])

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id)
    if (!target) return
    const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 0
    const top = window.scrollY + target.getBoundingClientRect().top - headerHeight - 14
    setActiveSectionId(id)
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }

  // ---------- edges (svg overlay) ----------
  const lanesRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState<EdgePath[]>([])
  const edgeActiveId = view === 'war' ? hoverId ?? pinnedRelationId : null

  // ---------- 代际树 parent→child 连线 ----------
  const treeRef = useRef<HTMLDivElement>(null)
  const [treeEdges, setTreeEdges] = useState<TreeEdgePath[]>([])
  const familyRef = useRef<HTMLDivElement>(null)
  const [familyEdges, setFamilyEdges] = useState<TreeEdgePath[]>([])

  const relIds = useMemo(() => {
    if (!edgeActiveId) return null
    const s = new Set(kinRelOf(edgeActiveId).map((r) => r.other))
    s.add(edgeActiveId)
    return s
  }, [edgeActiveId, kinRelOf])

  const [resizeTick, setResizeTick] = useState(0)

  useEffect(() => {
    const container = lanesRef.current
    if (!edgeActiveId || !container) { setEdges([]); return }
    const box = container.getBoundingClientRect()
    const scale = zoomByView.war
    const cards = container.querySelectorAll<HTMLElement>('.card')
    const map: Record<string, HTMLElement> = {}
    cards.forEach((el) => { const id = el.dataset.id; if (id) map[id] = el })
    const src = map[edgeActiveId]
    if (!src) { setEdges([]); return }
    const bounds = (el: HTMLElement) => {
      const b = el.getBoundingClientRect()
      return {
        x: (b.left - box.left) / scale,
        y: (b.top - box.top) / scale,
        width: b.width / scale,
        height: b.height / scale,
        cx: (b.left - box.left + b.width / 2) / scale,
        cy: (b.top - box.top + b.height / 2) / scale,
      }
    }
    const p0 = bounds(src)
    const list: EdgePath[] = []
    kinRelOf(edgeActiveId).forEach((r) => {
      const t = map[r.other]
      if (!t) return
      const p1 = bounds(t)
      const directional = !!relTypeByValue[r.kind]?.is_directional
      // 方向性关系按语义源→靶画:dir 'in' 时活动节点是靶,反向绘制使箭头指向靶。
      const [a, b] = directional && r.dir === 'in' ? [p1, p0] : [p0, p1]
      const dx = b.cx - a.cx
      const dy = b.cy - a.cy
      const horizontal = Math.abs(dx) > Math.abs(dy)
      const x0 = horizontal ? a.cx + Math.sign(dx) * a.width / 2 : a.cx
      const y0 = horizontal ? a.cy : a.cy + Math.sign(dy) * a.height / 2
      const x1 = horizontal ? b.cx - Math.sign(dx) * b.width / 2 : b.cx
      const y1 = horizontal ? b.cy : b.cy - Math.sign(dy) * b.height / 2
      const midX = (x0 + x1) / 2
      const midY = (y0 + y1) / 2
      const d = horizontal
        ? `M${x0},${y0} C${midX},${y0} ${midX},${y1} ${x1},${y1}`
        : `M${x0},${y0} C${x0},${midY} ${x1},${midY} ${x1},${y1}`
      list.push({
        d,
        color: relColor(r.kind),
        label: r.kind === 'parent' ? '父母 → 子女' : r.kind === 'spouse' ? '配偶' : '兄弟姐妹',
        labelX: midX,
        labelY: midY - 5,
        directional,
      })
    })
    setEdges(list)
  }, [edgeActiveId, view, query, resizeTick, kinRelOf, relColor, relTypeByValue, zoomByView.war])

  useEffect(() => {
    const onResize = () => setResizeTick((t) => t + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setSearchHistory(readSearchHistory())
    let active = true
    if (!loadHotSearches) return
    loadHotSearches()
      .then((payload) => {
        if (!active || !Array.isArray(payload)) return
        setHotSearches(
          payload
            .filter((item: unknown): item is HotSearchTerm => {
              if (!item || typeof item !== 'object') return false
              const candidate = item as Partial<HotSearchTerm>
              return typeof candidate.term === 'string' && typeof candidate.count === 'number'
            })
            .slice(0, 8),
        )
      })
      .catch(() => {
        if (active) setHotSearches([])
      })
    return () => {
      active = false
    }
  }, [loadHotSearches])

  const recordSearch = useCallback((term: string) => {
    const normalized = term.trim().slice(0, 100)
    if (!normalized) return
    setSearchHistory(addSearchHistory(normalized))
    if (!trackSearch) return
    void trackSearch(normalized)
      .then((success) => {
        if (!success) return
        setHotSearches((current) => {
          const previous = current.find((item) => item.term === normalized)
          return [
            { term: normalized, count: (previous?.count || 0) + 1 },
            ...current.filter((item) => item.term !== normalized),
          ]
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
        })
      })
      .catch(() => undefined)
  }, [trackSearch])


  // ---------- search suggestions ----------
  const suggestions = useMemo(() => {
    if (!query) return []
    const figureResults = figures
      .map((figure) => ({
        kind: 'figure' as const,
        figure,
        score: scoreFigure(searchIndex.get(figure.id), query),
      }))
      .filter((result) => result.score > 0)
    const matchedFigureIds = new Set(figureResults.map((result) => result.figure.id))
    const nameResults = nameIndex
      .map((entry) => ({
        kind: 'name' as const,
        entry,
        score: scoreNameEntry(properNameSearchIndex.get(entry.id), query),
      }))
      .filter(
        (result) =>
          result.score > 0 &&
          !result.entry.linked_figure_ids.some((id) => matchedFigureIds.has(id)),
      )

    return [...figureResults, ...nameResults]
      .sort(
        (a, b) =>
          b.score - a.score ||
          (a.kind === b.kind ? 0 : a.kind === 'figure' ? -1 : 1) ||
          (a.kind === 'name' && b.kind === 'name'
            ? a.entry.sort_order - b.entry.sort_order
            : 0),
      )
      .slice(0, 10)
  }, [query, figures, nameIndex, searchIndex, properNameSearchIndex])

  // ---------- drawer ----------
  const openDrawer = (id: string) => {
    setSelectedId(id)
    setSuggestOpen(false)
  }
  const closeDrawer = () => setSelectedId(null)

  // ---------- family navigation ----------
  const setFocus = (id: string, push = true) => {
    if (push && focusId && id !== focusId) setFamHist((h) => [...h, focusId])
    setLocatedId(null)
    setFocusId(id)
    setFocusFactionId(byId[id]?.faction_id || '')
  }
  const goBack = (target: string) => {
    if (target === '__prev') {
      setFamHist((h) => {
        const copy = [...h]
        const prev = copy.pop()
        if (prev) {
          setFocusId(prev)
          setFocusFactionId(byId[prev]?.faction_id || '')
        }
        return copy
      })
    } else {
      setFocusId(target)
      setFocusFactionId(byId[target]?.faction_id || '')
    }
  }

  const focusCategoryOptions = useMemo(
    () =>
      factions
        .filter((faction) => (facCounts[faction.id] || 0) > 0)
        .sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99)),
    [factions, facCounts],
  )

  const sortFocusFigures = useCallback(
    (a: HomericFigure, b: HomericFigure) =>
      (genOf(a.id) ?? Number.POSITIVE_INFINITY) - (genOf(b.id) ?? Number.POSITIVE_INFINITY) ||
      a.name_zh.localeCompare(b.name_zh, 'zh'),
    [genOf],
  )

  const focusOptions = useMemo(
    () => figures
      .filter((figure) => !focusFactionId || figure.faction_id === focusFactionId)
      .sort(sortFocusFigures),
    [figures, focusFactionId, sortFocusFigures],
  )

  const chooseFocusFaction = (factionId: string) => {
    const nextFocus = figures
      .filter((figure) => !factionId || figure.faction_id === factionId)
      .sort(sortFocusFigures)[0]?.id || 'zeus'
    setFocusFactionId(factionId)
    setFocusId(factionId ? nextFocus : 'zeus')
    setLocatedId(null)
    setFamHist([])
  }

  const chooseFocusFigure = (id: string) => {
    if (id) {
      setFocus(id)
      return
    }
    setFocusId('')
    setLocatedId(null)
    setFamHist([])
  }

  const resetFocus = () => {
    setQuery('')
    setSuggestOpen(false)
    setLocatedId(null)
    setPendingDrawerId(null)
    setFocusId('zeus')
    setFocusFactionId('')
    setFamHist([])
    setSelectedId(null)
    setPinnedRelationId(null)
  }

  const clearSearch = () => {
    setQuery('')
    setSuggestOpen(false)
    setLocatedId(null)
    setPendingDrawerId(null)
    setSelectedNameEntry(null)
  }

  const clearRelationHighlight = () => {
    setLocatedId(null)
    setPinnedRelationId(null)
    setPendingDrawerId(null)
    setHoverId(null)
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('.card,.fc,.tc,button,input,select,a')) return
    clearRelationHighlight()
  }

  const selectSearchResult = (id: string, searchedTerm = query) => {
    setSuggestOpen(false)
    setSelectedNameEntry(null)
    recordSearch(searchedTerm || name(byId[id]) || '')
    if (view === 'tree' && treeMode === 'ego') setFocus(id)
    if (view === 'war') setPinnedRelationId(id)
    setLocatedId(id)
    setPendingDrawerId(id)
  }

  const selectNameIndexResult = (entry: HomericNameIndexEntry, searchedTerm = query) => {
    const linkedId = entry.linked_figure_ids.find((id) => byId[id])
    if (linkedId) {
      selectSearchResult(linkedId, searchedTerm)
      return
    }
    setSuggestOpen(false)
    recordSearch(searchedTerm || entry.name_zh)
    setLocatedId(null)
    setPendingDrawerId(null)
    setSelectedNameEntry(entry)
  }

  const searchFromSavedTerm = (term: string) => {
    setQuery(term)
    const bestFigure = figures
      .map((figure) => ({ figure, score: scoreFigure(searchIndex.get(figure.id), term) }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)[0]
    if (bestFigure) {
      selectSearchResult(bestFigure.figure.id, term)
      return
    }
    const bestName = nameIndex
      .map((entry) => ({
        entry,
        score: scoreNameEntry(properNameSearchIndex.get(entry.id), term),
      }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.sort_order - b.entry.sort_order)[0]
    if (bestName) selectNameIndexResult(bestName.entry, term)
    else setSuggestOpen(true)
  }

  const clearSearchHistory = () => {
    window.localStorage.removeItem(HOMERIC_SEARCH_HISTORY_KEY)
    setSearchHistory([])
  }

  // 搜索结果先滚动定位，再打开人物详情；高亮保持到清除搜索或重新选择人物。
  useEffect(() => {
    if (!locatedId) return
    const frame = window.requestAnimationFrame(() => {
      const selector =
        view === 'war'
          ? `.card[data-id="${locatedId}"]`
          : treeMode === 'layers'
            ? `.tc[data-tid="${locatedId}"]`
            : `.fc[data-fid="${locatedId}"]`
      document.querySelector<HTMLElement>(selector)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      })
    })
    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [locatedId, view, treeMode, focusId, query])

  useEffect(() => {
    if (!pendingDrawerId) return
    const timer = window.setTimeout(() => {
      setSelectedId(pendingDrawerId)
      setPendingDrawerId(null)
    }, 450)
    return () => window.clearTimeout(timer)
  }, [pendingDrawerId])

  useEffect(() => {
    if (!selectedId) return
    const frame = window.requestAnimationFrame(() => {
      const scroller = relationGraphRef.current
      if (scroller) scroller.scrollLeft = Math.max(0, (scroller.scrollWidth - scroller.clientWidth) / 2)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selectedId])

  const facSort = useCallback((id: string | null) => facById[id || '']?.sort_order ?? 99, [facById])

  // 人物谱系:递归收集焦点人物的全部直系祖先与后代。
  // 只补充焦点同辈、焦点及后代的配偶作上下文，避免从远祖旁支膨胀成全景图。
  const egoLineage = useMemo(() => {
    const ancestors = new Set<string>()
    const descendants = new Set<string>()
    const walk = (
      id: string,
      next: (figureId: string) => string[],
      found: Set<string>,
      visiting: Set<string>,
    ) => {
      if (visiting.has(id)) return
      const branch = new Set(visiting)
      branch.add(id)
      next(id).forEach((relatedId) => {
        if (!byId[relatedId]) return
        found.add(relatedId)
        walk(relatedId, next, found, branch)
      })
    }
    if (focusId && byId[focusId]) {
      walk(focusId, parentsOf, ancestors, new Set())
      walk(focusId, childrenOf, descendants, new Set())
    }

    const siblings = new Set<string>()
    parentsOf(focusId).forEach((parentId) => {
      childrenOf(parentId).forEach((id) => {
        if (id !== focusId && !ancestors.has(id) && !descendants.has(id)) siblings.add(id)
      })
    })

    const bloodline = new Set<string>([...ancestors, focusId, ...descendants].filter(Boolean))
    const partners = new Set<string>()
    ;[focusId, ...descendants].filter(Boolean).forEach((id) => {
      partnersOf(id).forEach((partnerId) => {
        if (byId[partnerId] && !bloodline.has(partnerId) && !siblings.has(partnerId)) partners.add(partnerId)
      })
    })

    const roleById = new Map<string, 'focus' | 'ancestor' | 'descendant' | 'sibling' | 'partner'>()
    ancestors.forEach((id) => roleById.set(id, 'ancestor'))
    descendants.forEach((id) => roleById.set(id, 'descendant'))
    siblings.forEach((id) => roleById.set(id, 'sibling'))
    partners.forEach((id) => roleById.set(id, 'partner'))
    if (focusId) roleById.set(focusId, 'focus')

    const fallbackGen = new Map<string, number | null>()
    partners.forEach((partnerId) => {
      if (genOf(partnerId) != null) return
      const related = [focusId, ...descendants].find((id) => partnersOf(id).includes(partnerId))
      fallbackGen.set(partnerId, related ? genOf(related) : null)
    })

    const buckets = new Map<number, string[]>()
    const unknown: string[] = []
    roleById.forEach((_role, id) => {
      const gen = genOf(id) ?? fallbackGen.get(id) ?? null
      if (gen == null) {
        unknown.push(id)
        return
      }
      if (!buckets.has(gen)) buckets.set(gen, [])
      buckets.get(gen)!.push(id)
    })
    const priority = { focus: 0, ancestor: 1, descendant: 1, sibling: 2, partner: 3 }
    const sortIds = (a: string, b: string) =>
      priority[roleById.get(a)!] - priority[roleById.get(b)!] ||
      facSort(a) - facSort(b) ||
      byId[a].name_zh.localeCompare(byId[b].name_zh, 'zh')
    const rows = [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([gen, ids]) => ({ gen, ids: ids.sort(sortIds) }))
    unknown.sort(sortIds)

    return {
      rows,
      unknown,
      roleById,
      firstGen: rows[0]?.gen ?? null,
      lastGen: rows.at(-1)?.gen ?? null,
      ancestors: ancestors.size,
      descendants: descendants.size,
    }
  }, [focusId, byId, parentsOf, childrenOf, partnersOf, genOf, facSort])

  // 红框中的导航展示真实血缘主链，而不是用户的点击历史。
  // 多条祖先分支时优先选择能追溯到卡俄斯的路径，其次选起点代际更早、链条更长的路径。
  const focusAncestryPath = useMemo(() => {
    if (!focusId || !byId[focusId]) return []
    const memo = new Map<string, string[]>()
    const bestPathTo = (id: string, visiting: Set<string>): string[] => {
      if (visiting.has(id)) return [id]
      const cached = memo.get(id)
      if (cached) return cached
      const branch = new Set(visiting)
      branch.add(id)
      const parentIds = parentsOf(id).filter((parentId) => byId[parentId])
      if (!parentIds.length) {
        const root = [id]
        memo.set(id, root)
        return root
      }
      const candidates = parentIds.map((parentId) => [...bestPathTo(parentId, branch), id])
      candidates.sort((a, b) => {
        const aChaos = a[0] === 'chaos' ? 1 : 0
        const bChaos = b[0] === 'chaos' ? 1 : 0
        if (aChaos !== bChaos) return bChaos - aChaos
        const aRootGen = genOf(a[0]) ?? Number.POSITIVE_INFINITY
        const bRootGen = genOf(b[0]) ?? Number.POSITIVE_INFINITY
        if (aRootGen !== bRootGen) return aRootGen - bRootGen
        if (a.length !== b.length) return b.length - a.length
        return a.map((nodeId) => byId[nodeId].name_zh).join('').localeCompare(
          b.map((nodeId) => byId[nodeId].name_zh).join(''),
          'zh',
        )
      })
      const best = candidates[0]
      memo.set(id, best)
      return best
    }
    return bestPathTo(focusId, new Set())
  }, [focusId, byId, parentsOf, genOf])

  const familyActiveId =
    view === 'tree' && treeMode === 'ego' ? hoverId || locatedId : null

  // 默认仅绘制浅灰色亲子背景线；交互时再高亮并补充其他直接亲属关系。
  useEffect(() => {
    if (view !== 'tree' || treeMode !== 'ego') {
      setFamilyEdges([])
      return
    }
    const container = familyRef.current
    if (!container) return
    const box = container.getBoundingClientRect()
    const scale = zoomByView.ego
    const cards = container.querySelectorAll<HTMLElement>('.fc')
    const map: Record<string, HTMLElement> = {}
    cards.forEach((el) => {
      const id = el.dataset.fid
      if (id) map[id] = el
    })
    const activeNeighborhood = familyActiveId
      ? lineageNeighborhood(familyActiveId)
      : null
    const grouped = new Map<string, typeof relations>()
    relations.forEach((relation) => {
      if (!KINSHIP_RELATIONS.has(relation.relation_type)) return
      const key = [relation.from_figure_id, relation.to_figure_id].sort().join('::')
      const existing = grouped.get(key)
      if (existing) existing.push(relation)
      else grouped.set(key, [relation])
    })

    const bounds = (el: HTMLElement) => {
      const b = el.getBoundingClientRect()
      return {
        left: (b.left - box.left) / scale,
        top: (b.top - box.top) / scale,
        width: b.width / scale,
        height: b.height / scale,
        cx: (b.left - box.left + b.width / 2) / scale,
        cy: (b.top - box.top + b.height / 2) / scale,
      }
    }
    const paths: TreeEdgePath[] = []
    grouped.forEach((pairRelations) => {
      const parentRelation = pairRelations.find((relation) => relation.relation_type === 'parent')
      const baseRelation = parentRelation || pairRelations[0]
      const fromId = baseRelation.from_figure_id
      const toId = baseRelation.to_figure_id
      const fromEl = map[fromId]
      const toEl = map[toId]
      if (!fromEl || !toEl) return

      const hot = !!activeNeighborhood && activeNeighborhood.has(fromId) && activeNeighborhood.has(toId)
      if (!parentRelation && !hot) return

      const from = bounds(fromEl)
      const to = bounds(toEl)
      let p0: { x: number; y: number }
      let p1: { x: number; y: number }
      let p2: { x: number; y: number }
      let p3: { x: number; y: number }

      if (parentRelation) {
        const midY = (from.top + from.height + to.top) / 2
        p0 = { x: from.cx, y: from.top + from.height }
        p1 = { x: from.cx, y: midY }
        p2 = { x: to.cx, y: midY }
        p3 = { x: to.cx, y: to.top }
      } else {
        const dx = to.cx - from.cx
        const dy = to.cy - from.cy
        const horizontal = Math.abs(dx) > Math.abs(dy)
        p0 = horizontal
          ? { x: from.cx + Math.sign(dx) * from.width / 2, y: from.cy }
          : { x: from.cx, y: from.cy + Math.sign(dy) * from.height / 2 }
        p3 = horizontal
          ? { x: to.cx - Math.sign(dx) * to.width / 2, y: to.cy }
          : { x: to.cx, y: to.cy - Math.sign(dy) * to.height / 2 }
        const midX = (p0.x + p3.x) / 2
        const midY = (p0.y + p3.y) / 2
        p1 = horizontal ? { x: midX, y: p0.y } : { x: p0.x, y: midY }
        p2 = horizontal ? { x: midX, y: p3.y } : { x: p3.x, y: midY }
      }

      const kinds = [...new Set(pairRelations.map((relation) => relation.relation_type))]
      const relatedId = familyActiveId === fromId ? toId : fromId
      const labels = kinds.map((kind) => {
        if (kind === 'parent') {
          return familyActiveId === fromId
            ? kinshipRole(byId[toId]?.gender, 'child', locale)
            : kinshipRole(byId[fromId]?.gender, 'parent', locale)
        }
        if (kind === 'spouse') return kinshipRole(byId[relatedId]?.gender, 'spouse', locale)
        return kinshipRole(byId[relatedId]?.gender, 'sibling', locale)
      })
      const relatedCard = familyActiveId === fromId ? to : from
      const activeIsChild = !!parentRelation && familyActiveId === toId
      const dash = kinds.includes('parent') ? undefined : kinds.includes('spouse') ? '7 4' : '2 4'

      paths.push({
        d: `M${p0.x},${p0.y} C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`,
        hot,
        label: hot ? labels.join(' · ') : '',
        labelX: relatedCard.cx,
        labelY: activeIsChild ? relatedCard.top + relatedCard.height + 12 : relatedCard.top - 6,
        dash,
      })
    })
    setFamilyEdges(paths)
  }, [view, treeMode, egoLineage, familyActiveId, lineageNeighborhood, relations, resizeTick, zoomByView.ego, byId])

  // ============ render helpers ============
  const Card = (c: HomericFigure) => {
    const dim = relIds ? !relIds.has(c.id) : false
    const hot = edgeActiveId === c.id
    return (
      <div
        key={c.id}
        className={`card${dim ? ' dim' : ''}${hot ? ' hot' : ''}${locatedId === c.id ? ' located' : ''}`}
        data-id={c.id}
        style={{ borderColor: facColor(c.faction_id) }}
        onClick={() => {
          setPinnedRelationId(c.id)
          openDrawer(c.id)
        }}
        onMouseEnter={() => setHoverId(c.id)}
        onMouseLeave={() => setHoverId(null)}
      >
        <div className="bar" style={{ background: facColor(c.faction_id) }} />
        <div className="body">
          {c.name_roman && <span className="roman"><Landmark size={11} /> {c.name_roman}</span>}
          <div className="zh">{name(c)}</div>
          <div className="en">{secondary(c)}</div>
          <div className="gen">
            <span className="g1">{generation(genOf(c.id))}</span>
            {genOf(c.id) != null && facRankOf(c.id) != null && (
              <span className="g2" style={{ color: facColor(c.faction_id) }}>
                {facLabel(c.faction_id)} · {generation(facRankOf(c.id))}
              </span>
            )}
          </div>
          <span className="dom" style={chipStyle(facColor(c.faction_id))}>
            {c.domain || facLabel(c.faction_id)}
          </span>
          <div className="ep">{c.epithet || (c.bio && c.bio[0]) || ''}</div>
        </div>
      </div>
    )
  }

  const godBlock = (
    title: string,
    list: HomericFigure[],
    badge: string,
    color: string,
    sectionId?: string,
  ) => {
    const cards = list.filter(matches)
    if (!cards.length) return null
    return (
      <div className="group" id={sectionId} data-war-section={sectionId ? '' : undefined}>
        <h4>
          <span className="badge" style={chipStyle(color)}>{t(badge)}</span>
          {t(title)}
        </h4>
        <div className="grid">{cards.map(Card)}</div>
      </div>
    )
  }

  const factionCol = (
    title: string,
    list: HomericFigure[],
    color: string,
    badge: string,
    sectionId?: string,
  ) => {
    const filtered = list.filter(matches)
    const byGroup: Record<string, HomericFigure[]> = {}
    filtered.forEach((c) => {
      const g = c.group_label || '其他'
      ;(byGroup[g] = byGroup[g] || []).push(c)
    })
    const entries = Object.entries(byGroup)
    return (
      <div id={sectionId} data-war-section={sectionId ? '' : undefined}>
        <div className="lane-title">
          <span className="badge" style={chipStyle(color)}>{t(badge)}</span>
          {t(title)}
        </div>
        {entries.length ? (
          entries.map(([g, cs]) => (
            <div className="group" key={g}>
              <h4>{t(g)}</h4>
              <div className="grid">{cs.map(Card)}</div>
            </div>
          ))
        ) : (
          <div className="empty">{t('无匹配')}</div>
        )}
      </div>
    )
  }

  // ---------- family view rendering ----------
  const familyHot = useMemo(() => {
    if (!familyActiveId) return null
    return lineageNeighborhood(familyActiveId)
  }, [familyActiveId, lineageNeighborhood])

  const selectFamilyCard = (id: string) => {
    setFocus(id)
    setLocatedId(id)
    setPendingDrawerId(null)
    openDrawer(id)
  }

  const FamCard = ({ id, cls = '', note }: { id: string; cls?: string; note?: string }) => {
    const c = byId[id]
    if (!c) return null
    const dim = familyHot ? !familyHot.has(id) : false
    const hot = !!familyHot && familyHot.has(id)
    return (
      <div
        className={`fc ${cls}${dim ? ' dim' : ''}${hot ? ' hot' : ''}${locatedId === id ? ' located' : ''}`}
        data-fid={id}
        style={{ borderColor: facColor(c.faction_id) }}
        title={`${name(c)} ${secondary(c)}`}
        onClick={() => selectFamilyCard(id)}
        onMouseEnter={() => setHoverId(id)}
        onMouseLeave={() => setHoverId(null)}
      >
        <div className="b" style={{ background: facColor(c.faction_id) }} />
        <div className="in">
          {c.name_roman && <span className="roman"><Landmark size={10} /> {c.name_roman}</span>}
          <div className="z">{name(c)}</div>
          <div className="en">{secondary(c)}</div>
          {note && <span className="frole">{t(note)}</span>}
          <div className="fgen">
            <span className="g1">{generation(genOf(id))}</span>
            {genOf(id) != null && facRankOf(id) != null && (
              <span className="g2">{facLabel(c.faction_id)} · {generation(facRankOf(id))}</span>
            )}
          </div>
          <div className="d">{c.domain || facLabel(c.faction_id)}</div>
        </div>
      </div>
    )
  }

  const familyContent = () => {
    const c = byId[focusId]
    if (!c) return null
    const roleLabel = {
      focus: '焦点',
      ancestor: '',
      descendant: '',
      sibling: '同辈',
      partner: '配偶',
    }
    const focusGen = genOf(focusId)
    const sectionLabel = (gen: number) => {
      if (focusGen == null) return '家系成员'
      if (gen < focusGen) return '直系祖先'
      if (gen === focusGen) return '焦点一代'
      return '直系后代'
    }

    return (
      <>
        <svg className="fedges" aria-hidden="true">
          {familyEdges.map((edge, index) => (
            <path
              key={index}
              className={edge.hot ? 'hot' : ''}
              d={edge.d}
              strokeDasharray={edge.dash}
            />
          ))}
          {familyEdges.map((edge, index) =>
            edge.label ? (
              <text
                key={`label-${index}`}
                className="fedge-label"
                x={edge.labelX}
                y={edge.labelY}
                textAnchor="middle"
              >
                {t(edge.label)}
              </text>
            ) : null,
          )}
        </svg>
        <div className="ego-summary">
          <b>{en ? `${name(c)}: continuous lineage` : `${name(c)}的连续谱系`}</b>
          <span>
            {egoLineage.firstGen != null && egoLineage.lastGen != null
              ? (en ? `Generations ${egoLineage.firstGen}–${egoLineage.lastGen}` : `从第 ${egoLineage.firstGen} 代排至第 ${egoLineage.lastGen} 代`)
              : t('按已录入血缘展开')}
            {' · '}{en ? `${egoLineage.ancestors} direct ${egoLineage.ancestors === 1 ? 'ancestor' : 'ancestors'} · ${egoLineage.descendants} direct ${egoLineage.descendants === 1 ? 'descendant' : 'descendants'}` : `${egoLineage.ancestors} 位直系祖先 · ${egoLineage.descendants} 位直系后代`}
          </span>
        </div>
        {egoLineage.rows.map(({ gen, ids }) => (
          <div className="ego-row" key={gen}>
            <div className="ego-label">
              <b>{generation(gen)}</b>
              <span>{t(sectionLabel(gen))} · {en ? `${ids.length} ${ids.length === 1 ? 'person' : 'people'}` : `${ids.length}人`}</span>
            </div>
            <div className="ego-cards">
              {ids.map((id) => {
                const role = egoLineage.roleById.get(id)!
                return (
                  <FamCard
                    key={id}
                    id={id}
                    cls={role === 'focus' ? 'big' : role === 'sibling' || role === 'partner' ? 'context' : ''}
                    note={roleLabel[role]}
                  />
                )
              })}
            </div>
          </div>
        ))}
        {egoLineage.unknown.length > 0 && (
          <div className="ego-row">
            <div className="ego-label muted"><b>{t('未定代际')}</b><span>{en ? `${egoLineage.unknown.length} people` : `${egoLineage.unknown.length}人`}</span></div>
            <div className="ego-cards">
              {egoLineage.unknown.map((id) => {
                const role = egoLineage.roleById.get(id)!
                return <FamCard key={id} id={id} cls="context" note={roleLabel[role]} />
              })}
            </div>
          </div>
        )}
      </>
    )
  }

  // ---------- 代际树:按规范代际分层 ----------
  const treeRows = useMemo(() => {
    const buckets = new Map<number, HomericFigure[]>()
    const unknown: HomericFigure[] = []
    figures
      .filter((figure) => treeMode !== 'ego' || focusId || !focusFactionId || figure.faction_id === focusFactionId)
      .forEach((c) => {
        const g = genOf(c.id)
        if (g == null) {
          unknown.push(c)
          return
        }
        if (!buckets.has(g)) buckets.set(g, [])
        buckets.get(g)!.push(c)
      })
    const cmp = (a: HomericFigure, b: HomericFigure) =>
      facSort(a.faction_id) - facSort(b.faction_id) || a.name_zh.localeCompare(b.name_zh, 'zh')
    const rows = [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([gen, list]) => ({ gen, list: list.sort(cmp) }))
    return { rows, unknown: unknown.sort(cmp) }
  }, [figures, genOf, facSort, treeMode, focusId, focusFactionId])

  const showingEgoOverview = view === 'tree' && treeMode === 'ego' && !focusId
  const treeActiveId =
    view === 'tree' && (treeMode === 'layers' || showingEgoOverview) ? hoverId || locatedId : null

  // 搜索定位或悬停时，突出目标及其直接亲属关系，与阵营关系图保持一致。
  const treeHot = useMemo(() => {
    if (!treeActiveId) return null
    return lineageNeighborhood(treeActiveId)
  }, [treeActiveId, lineageNeighborhood])

  // 默认仅绘制浅灰色亲子背景线；悬浮或搜索定位人物后再高亮并补充其他关系。
  useEffect(() => {
    if (view !== 'tree' || (treeMode !== 'layers' && !showingEgoOverview)) {
      setTreeEdges([])
      return
    }
    const container = treeRef.current
    if (!container) return
    const box = container.getBoundingClientRect()
    const scale = treeMode === 'layers' ? zoomByView.layers : zoomByView.ego
    const cards = container.querySelectorAll<HTMLElement>('.tc')
    const map: Record<string, HTMLElement> = {}
    cards.forEach((el) => {
      const id = el.dataset.tid
      if (id) map[id] = el
    })
    const grouped = new Map<string, typeof relations>()
    relations.forEach((relation) => {
      if (!KINSHIP_RELATIONS.has(relation.relation_type)) return
      const key = [relation.from_figure_id, relation.to_figure_id].sort().join('::')
      const existing = grouped.get(key)
      if (existing) existing.push(relation)
      else grouped.set(key, [relation])
    })

    const bounds = (el: HTMLElement) => {
      const b = el.getBoundingClientRect()
      return {
        left: (b.left - box.left) / scale,
        top: (b.top - box.top) / scale,
        width: b.width / scale,
        height: b.height / scale,
        cx: (b.left - box.left + b.width / 2) / scale,
        cy: (b.top - box.top + b.height / 2) / scale,
      }
    }

    const list: TreeEdgePath[] = []
    grouped.forEach((pairRelations) => {
      const parentRelation = pairRelations.find((relation) => relation.relation_type === 'parent')
      const baseRelation = parentRelation || pairRelations[0]
      const fromId = baseRelation.from_figure_id
      const toId = baseRelation.to_figure_id
      const fromEl = map[fromId]
      const toEl = map[toId]
      if (!fromEl || !toEl) return

      const hot = !!treeHot && treeHot.has(fromId) && treeHot.has(toId)
      if (!parentRelation && !hot) return

      const from = bounds(fromEl)
      const to = bounds(toEl)
      let p0: { x: number; y: number }
      let p1: { x: number; y: number }
      let p2: { x: number; y: number }
      let p3: { x: number; y: number }

      if (parentRelation) {
        const midY = (from.top + from.height + to.top) / 2
        p0 = { x: from.cx, y: from.top + from.height }
        p1 = { x: from.cx, y: midY }
        p2 = { x: to.cx, y: midY }
        p3 = { x: to.cx, y: to.top }
      } else {
        const dx = to.cx - from.cx
        const dy = to.cy - from.cy
        const horizontal = Math.abs(dx) > Math.abs(dy)
        p0 = horizontal
          ? { x: from.cx + Math.sign(dx) * from.width / 2, y: from.cy }
          : { x: from.cx, y: from.cy + Math.sign(dy) * from.height / 2 }
        p3 = horizontal
          ? { x: to.cx - Math.sign(dx) * to.width / 2, y: to.cy }
          : { x: to.cx, y: to.cy - Math.sign(dy) * to.height / 2 }
        const midX = (p0.x + p3.x) / 2
        const midY = (p0.y + p3.y) / 2
        p1 = horizontal ? { x: midX, y: p0.y } : { x: p0.x, y: midY }
        p2 = horizontal ? { x: midX, y: p3.y } : { x: p3.x, y: midY }
      }

      const kinds = [...new Set(pairRelations.map((relation) => relation.relation_type))]
      const relatedId = treeActiveId === fromId ? toId : fromId
      const labels = kinds.map((kind) => {
        if (kind === 'parent') {
          return treeActiveId === fromId
            ? kinshipRole(byId[toId]?.gender, 'child', locale)
            : kinshipRole(byId[fromId]?.gender, 'parent', locale)
        }
        if (kind === 'spouse') return kinshipRole(byId[relatedId]?.gender, 'spouse', locale)
        return kinshipRole(byId[relatedId]?.gender, 'sibling', locale)
      })
      const relatedCard = treeActiveId === fromId ? to : from
      const activeIsChild = !!parentRelation && treeActiveId === toId
      const dash = kinds.includes('parent') ? undefined : kinds.includes('spouse') ? '7 4' : '2 4'

      list.push({
        d: `M${p0.x},${p0.y} C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`,
        hot,
        label: hot ? labels.join(' · ') : '',
        labelX: relatedCard.cx,
        labelY: activeIsChild ? relatedCard.top + relatedCard.height + 12 : relatedCard.top - 6,
        dash,
      })
    })
    setTreeEdges(list)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, treeMode, showingEgoOverview, treeRows, treeActiveId, treeHot, relations, query, resizeTick, zoomByView.layers, zoomByView.ego, byId])

  const TreeCard = ({ id }: { id: string }) => {
    const c = byId[id]
    if (!c) return null
    const dim = treeHot ? !treeHot.has(id) : false
    const hot = (hoverId || locatedId) === id
    return (
      <div
        className={`tc${dim ? ' dim' : ''}${hot ? ' hot' : ''}${locatedId === id ? ' located' : ''}`}
        data-tid={id}
        style={{ borderColor: facColor(c.faction_id) }}
        title={`${name(c)} ${secondary(c)}`}
        onClick={() => openDrawer(id)}
        onMouseEnter={() => setHoverId(id)}
        onMouseLeave={() => setHoverId(null)}
      >
        <div className="b" style={{ background: facColor(c.faction_id) }} />
        <div className="in">
          {c.name_roman && <span className="roman"><Landmark size={10} /> {c.name_roman}</span>}
          <div className="z">{name(c)}</div>
          <div className="en">{secondary(c)}</div>
          <div className="d">{c.domain || facLabel(c.faction_id)}</div>
          {facRankOf(id) != null && (
            <span className="fr" style={{ color: facColor(c.faction_id) }}>
              {facLabel(c.faction_id)} · {generation(facRankOf(id))}
            </span>
          )}
        </div>
      </div>
    )
  }

  const treeContent = () => {
    const { rows, unknown } = treeRows
    if (!rows.length && !unknown.length)
      return <div className="empty">{t('无匹配')}</div>
    return (
      <div className="tree zoom-surface" ref={treeRef} style={zoomSurfaceStyle}>
        <svg className="tedges">
          {treeEdges.map((e, i) => (
            <path
              key={i}
              d={e.d}
              className={e.hot ? 'te hot' : 'te'}
              fill="none"
              strokeDasharray={e.dash}
            />
          ))}
          {treeEdges.map((edge, index) =>
            edge.label ? (
              <text
                key={`label-${index}`}
                className="te-label"
                x={edge.labelX}
                y={edge.labelY}
                textAnchor="middle"
              >
                {t(edge.label)}
              </text>
            ) : null,
          )}
        </svg>
        {rows.map(({ gen, list }) => (
          <div className="trow" key={gen}>
            <div className="tlabel">
              <span className="tg">{generation(gen)}</span>
              <span className="tn">{list.length}</span>
            </div>
            <div className="tcards">
              {list.map((c) => <TreeCard key={c.id} id={c.id} />)}
            </div>
          </div>
        ))}
        {unknown.length > 0 && (
          <div className="trow" key="unknown">
            <div className="tlabel">
              <span className="tg muted">{t('未定代际')}</span>
              <span className="tn">{unknown.length}</span>
            </div>
            <div className="tcards">
              {unknown.map((c) => <TreeCard key={c.id} id={c.id} />)}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---------- drawer content ----------
  const drawerContent = () => {
    if (!selectedId) return null
    const c = byId[selectedId]
    if (!c) return null
    const rels = relOf(selectedId)
    const uniqueIds = (predicate: (relation: (typeof rels)[number]) => boolean) =>
      [...new Set(rels.filter(predicate).map((relation) => relation.other))].filter((id) => byId[id])
    const parentIds = uniqueIds((relation) => relation.kind === 'parent' && relation.dir === 'in')
    const childIds = uniqueIds((relation) => relation.kind === 'parent' && relation.dir === 'out')
    const spouseIds = uniqueIds((relation) => relation.kind === 'spouse')
    const spouseSet = new Set(spouseIds)
    const siblingIds = uniqueIds((relation) => relation.kind === 'sibling' && !spouseSet.has(relation.other))
    const siblingSet = new Set(uniqueIds((relation) => relation.kind === 'sibling'))
    const grandparentLinks = parentIds.flatMap((parentId) =>
      parentsOf(parentId)
        .filter((grandparentId) => byId[grandparentId])
        .map((grandparentId) => ({ grandparentId, parentId })),
    )
    const grandparentIds = [...new Set(grandparentLinks.map((link) => link.grandparentId))]
    const greatGrandparentLinks = grandparentIds.flatMap((grandparentId) =>
      parentsOf(grandparentId)
        .filter((greatGrandparentId) => byId[greatGrandparentId])
        .map((greatGrandparentId) => ({ greatGrandparentId, grandparentId })),
    )
    const greatGrandparentIds = [
      ...new Set(greatGrandparentLinks.map((link) => link.greatGrandparentId)),
    ]
    const otherRels = rels.filter((relation) => !KINSHIP_RELATIONS.has(relation.kind))
    const hasKinship =
      greatGrandparentIds.length + grandparentIds.length + parentIds.length + childIds.length +
        spouseIds.length + siblingIds.length > 0
    const displayedRelationCount =
      rels.length + grandparentLinks.length + greatGrandparentLinks.length

    const nodeWidth = 110
    const nodeHeight = 58
    const nodeStep = 132
    const widestRow = Math.max(
      1,
      greatGrandparentIds.length,
      grandparentIds.length,
      parentIds.length,
      childIds.length,
      Math.max(spouseIds.length, siblingIds.length) * 2 + 1,
    )
    const graphWidth = Math.max(360, widestRow * nodeStep + 40)
    const centerX = graphWidth / 2
    const hasGreatGrandparents = greatGrandparentIds.length > 0
    const hasGrandparents = grandparentIds.length > 0
    const greatGrandparentY = 16
    const grandparentY = hasGreatGrandparents ? 124 : 16
    const parentY = hasGrandparents ? grandparentY + 108 : 16
    const peerY = parentY + 102
    const childY = peerY + 112
    const greatGrandparentBusY = greatGrandparentY + nodeHeight + 20
    const grandparentBusY = grandparentY + nodeHeight + 20
    const parentBusY = parentY + nodeHeight + 20
    const childBusY = childY - 20
    const graphHeight = childIds.length > 0
      ? childY + nodeHeight + 16
      : peerY + nodeHeight + 24
    const centeredXs = (count: number) =>
      Array.from({ length: count }, (_, index) => centerX + (index - (count - 1) / 2) * nodeStep)
    const greatGrandparentXs = centeredXs(greatGrandparentIds.length)
    const greatGrandparentXById = new Map(
      greatGrandparentIds.map((id, index) => [id, greatGrandparentXs[index]]),
    )
    const grandparentXs = centeredXs(grandparentIds.length)
    const grandparentXById = new Map(
      grandparentIds.map((id, index) => [id, grandparentXs[index]]),
    )
    const parentXs = centeredXs(parentIds.length)
    const childXs = centeredXs(childIds.length)
    const spouseXs = spouseIds.map((_, index) => centerX + (index + 1) * nodeStep)
    const siblingXs = siblingIds.map((_, index) => centerX - (index + 1) * nodeStep)

    const relationNode = (id: string, x: number, y: number, role: string, self = false) => {
      const person = byId[id]
      if (!person) return null
      return (
        <button
          type="button"
          key={`${role}-${id}`}
          className={`kin-node${self ? ' self' : ''}`}
          style={{ left: x, top: y, borderColor: facColor(person.faction_id) }}
          title={self ? name(person) : en ? `View ${name(person)}` : `查看${name(person)}的详细信息`}
          onClick={self ? undefined : () => openDrawer(id)}
          disabled={self}
        >
          <span className="kin-role">{t(role)}</span>
          <b>{name(person)}</b>
          <small>{secondary(person) || person.name_roman || facLabel(person.faction_id)}</small>
        </button>
      )
    }

    return (
      <>
        <div className="dhead">
          <button className="close" onClick={closeDrawer} aria-label={t('关闭')}>×</button>
          <span className="fac" style={chipStyle(facColor(c.faction_id))}>
            {facLabel(c.faction_id)}{c.group_label ? ' · ' + t(c.group_label) : ''}
          </span>
          <h2 className="zh">{name(c)}</h2>
          <div className="en">
            {[secondary(c), c.name_roman ? t('罗马名 ') + c.name_roman : ''].filter(Boolean).join(' · ')}
          </div>
          {c.aliases && c.aliases.length > 0 && (
            <div className="alias">{t("别名 / 其他译名：")}{c.aliases.join(' / ')}</div>
          )}
          {c.variant_note && (
            <div className="variant-note">{c.variant_note}</div>
          )}
          <button type="button" className="person-share" onClick={shareView}>{t('分享此人物')}</button>
          {onLocaleChange && <button type="button" className="person-share lang-switch" lang={en ? 'zh-CN' : 'en'} aria-label={en ? '切换为中文' : 'Switch to English'} onClick={switchLanguage}>{en ? '中文' : 'English'}</button>}
          {shareUrl && <div className="person-share-result" role="status"><small>{shareStatus}</small><input aria-label={t('人物分享链接')} value={shareUrl} readOnly onFocus={event => event.currentTarget.select()} /></div>}
        </div>
        <div className="dbody">
          {en && <p className="translation-note" role="note">{c.translationStatus === 'missing' || c.translationStatus === 'stale'
            ? 'Some English fields are missing or awaiting an update; the Chinese source is shown there.'
            : 'Machine-assisted translation of the Chinese study notes. Mythological traditions and variants still need editorial review.'}
            {' '}<a href="https://github.com/adonisly/homeric-epic-map/issues">Suggest a correction</a></p>}
          {c.domain && (
            <div className="sec">
              <h5>{t('神职 / 身份')}</h5>
              <div style={{ fontSize: 14 }}>{c.domain}</div>
            </div>
          )}
          {c.bio && c.bio.length > 0 && (
            <div className="sec">
              <h5>{t('简介')}</h5>
              <ul>{c.bio.map((i, idx) => <li key={idx}>{i}</li>)}</ul>
            </div>
          )}
          <div className="sec">
            <h5>{en ? `Relationships (${displayedRelationCount})` : `人物关系图（${displayedRelationCount}）`}</h5>
            {hasKinship ? (
              <>
                <div className="kin-graph-scroll" ref={relationGraphRef}>
                  <div
                    className="kin-graph-canvas"
                    style={{ width: graphWidth, height: graphHeight }}
                    role="group"
                    aria-label={en ? `${name(c)} family relationship diagram` : `${name(c)}的亲属关系折线图`}
                  >
                    <svg className="kin-lines" width={graphWidth} height={graphHeight} aria-hidden="true">
                      {hasGreatGrandparents && (
                        <g className="kin-great-grandparent-lines">
                          {grandparentIds.map((grandparentId, grandparentIndex) => {
                            const linkedXs = greatGrandparentLinks
                              .filter((link) => link.grandparentId === grandparentId)
                              .map((link) => greatGrandparentXById.get(link.greatGrandparentId))
                              .filter((x): x is number => x !== undefined)
                            if (!linkedXs.length) return null
                            const grandparentX = grandparentXs[grandparentIndex]
                            return (
                              <g key={grandparentId}>
                                {linkedXs.map((x, index) => (
                                  <line
                                    key={`${grandparentId}-${index}`}
                                    x1={x}
                                    y1={greatGrandparentY + nodeHeight}
                                    x2={x}
                                    y2={greatGrandparentBusY}
                                  />
                                ))}
                                <line
                                  x1={Math.min(grandparentX, ...linkedXs)}
                                  y1={greatGrandparentBusY}
                                  x2={Math.max(grandparentX, ...linkedXs)}
                                  y2={greatGrandparentBusY}
                                />
                                <line
                                  x1={grandparentX}
                                  y1={greatGrandparentBusY}
                                  x2={grandparentX}
                                  y2={grandparentY}
                                />
                              </g>
                            )
                          })}
                        </g>
                      )}
                      {hasGrandparents && (
                        <g className="kin-grandparent-lines">
                          {parentIds.map((parentId, parentIndex) => {
                            const linkedXs = grandparentLinks
                              .filter((link) => link.parentId === parentId)
                              .map((link) => grandparentXById.get(link.grandparentId))
                              .filter((x): x is number => x !== undefined)
                            if (!linkedXs.length) return null
                            const parentX = parentXs[parentIndex]
                            return (
                              <g key={parentId}>
                                {linkedXs.map((x, index) => (
                                  <line
                                    key={`${parentId}-${index}`}
                                    x1={x}
                                    y1={grandparentY + nodeHeight}
                                    x2={x}
                                    y2={grandparentBusY}
                                  />
                                ))}
                                <line
                                  x1={Math.min(parentX, ...linkedXs)}
                                  y1={grandparentBusY}
                                  x2={Math.max(parentX, ...linkedXs)}
                                  y2={grandparentBusY}
                                />
                                <line
                                  x1={parentX}
                                  y1={grandparentBusY}
                                  x2={parentX}
                                  y2={parentY}
                                />
                              </g>
                            )
                          })}
                        </g>
                      )}
                      {parentIds.length > 0 && (
                        <g className="kin-parent-lines">
                          {parentXs.map((x, index) => (
                            <line
                              key={parentIds[index]}
                              x1={x}
                              y1={parentY + nodeHeight}
                              x2={x}
                              y2={parentBusY}
                            />
                          ))}
                          <line
                            x1={Math.min(...parentXs)}
                            y1={parentBusY}
                            x2={Math.max(...parentXs)}
                            y2={parentBusY}
                          />
                          <line x1={centerX} y1={parentBusY} x2={centerX} y2={peerY} />
                        </g>
                      )}
                      {childIds.length > 0 && (
                        <g className="kin-child-lines">
                          <line
                            x1={centerX}
                            y1={peerY + nodeHeight}
                            x2={centerX}
                            y2={childBusY}
                          />
                          <line
                            x1={Math.min(...childXs)}
                            y1={childBusY}
                            x2={Math.max(...childXs)}
                            y2={childBusY}
                          />
                          {childXs.map((x, index) => (
                            <line
                              key={childIds[index]}
                              x1={x}
                              y1={childBusY}
                              x2={x}
                              y2={childY}
                            />
                          ))}
                        </g>
                      )}
                      {siblingXs.map((x, index) => (
                        <line
                          className="kin-sibling-line"
                          key={siblingIds[index]}
                          x1={x + nodeWidth / 2}
                          y1={peerY + nodeHeight / 2}
                          x2={centerX - nodeWidth / 2}
                          y2={peerY + nodeHeight / 2}
                        />
                      ))}
                      {spouseXs.map((x, index) => (
                        <line
                          className="kin-spouse-line"
                          key={spouseIds[index]}
                          x1={centerX + nodeWidth / 2}
                          y1={peerY + nodeHeight / 2}
                          x2={x - nodeWidth / 2}
                          y2={peerY + nodeHeight / 2}
                        />
                      ))}
                    </svg>

                    {greatGrandparentIds.map((id, index) =>
                      relationNode(
                        id,
                        greatGrandparentXs[index],
                        greatGrandparentY,
                        kinshipRole(byId[id]?.gender, 'great-grandparent', locale),
                      ),
                    )}
                    {grandparentIds.map((id, index) =>
                      relationNode(
                        id,
                        grandparentXs[index],
                        grandparentY,
                        kinshipRole(byId[id]?.gender, 'grandparent', locale),
                      ),
                    )}
                    {parentIds.map((id, index) =>
                      relationNode(id, parentXs[index], parentY, kinshipRole(byId[id]?.gender, 'parent', locale)),
                    )}
                    {siblingIds.map((id, index) =>
                      relationNode(id, siblingXs[index], peerY, kinshipRole(byId[id]?.gender, 'sibling', locale)),
                    )}
                    {relationNode(selectedId, centerX, peerY, '本人', true)}
                    {spouseIds.map((id, index) =>
                      relationNode(
                        id,
                        spouseXs[index],
                        peerY,
                        siblingSet.has(id)
                          ? `${kinshipRole(byId[id]?.gender, 'spouse', locale)} · ${kinshipRole(byId[id]?.gender, 'sibling', locale)}`
                          : kinshipRole(byId[id]?.gender, 'spouse', locale),
                      ),
                    )}
                    {childIds.map((id, index) =>
                      relationNode(id, childXs[index], childY, kinshipRole(byId[id]?.gender, 'child', locale)),
                    )}
                  </div>
                </div>
                <p className="kin-hint">{t('向上显示曾祖父母、祖父母与父母，向下显示子女；左右表示同辈或配偶。点击关系人可继续查看。')}</p>
              </>
            ) : (
              <div className="relation-empty">{t('（暂无录入亲属关系）')}</div>
            )}

            {otherRels.length > 0 && (
              <div className="other-relations">
                <h6>{t('其他关系')}</h6>
                <div className="rel">
                  {otherRels.map((relation, index) => {
                    const person = byId[relation.other]
                    if (!person) return null
                    return (
                      <button
                        type="button"
                        className="relpill"
                        key={`${relation.kind}-${relation.other}-${index}`}
                        onClick={() => openDrawer(person.id)}
                      >
                        <span className="d" style={{ background: facColor(person.faction_id) }} />
                        <span className="rk">{relativeRelationLabel(relation.kind, relation.dir, locale, relLabel(relation.kind))}</span>
                        {name(person)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <div className={`hg${en ? ' hg-en' : ''}`}>
      <style>{HG_CSS}</style>

      <div className="hg-hero">
        <div className="htxt">
          <h1><Landmark size={22} strokeWidth={2} />{t('荷马史诗脉络图')}</h1>
          <p>{t('交互式探索荷马史诗中的神祇与英雄 · 神谱 · 特洛伊战争 · 伊利亚特 · 奥德赛')}</p>
        </div>
        <nav className="project-links" aria-label={t('项目与分享')}>
          {onLocaleChange && <button type="button" lang={en ? 'zh-CN' : 'en'} aria-label={en ? '切换为中文' : 'Switch to English'}
            onClick={switchLanguage}>{en ? '中文' : 'English'}</button>}
          <button type="button" onClick={shareView}>{t('分享当前视图')}</button>
          {catalogHref && <a href={catalogHref}>{t('人物索引')}</a>}
          {feedbackHref && <a href={feedbackHref} target="_blank" rel="noopener noreferrer">{t('纠错反馈')}</a>}
          {sourceHref && <a href={sourceHref} target="_blank" rel="noopener noreferrer">{t('源码 · AGPL-3.0')}</a>}
          {backHref && <a className="hero-back" href={backHref}><Home size={16} strokeWidth={2} /> <span>{t(backLabel)}</span></a>}
        </nav>
      </div>
      {shareUrl && <div className="share-result" role="status"><span>{shareStatus}</span><input aria-label={t('分享链接')} readOnly value={shareUrl} onFocus={event => event.currentTarget.select()} /><button type="button" onClick={() => setShareUrl('')}>{t('关闭')}</button></div>}

      <header className="hg-header" ref={headerRef}>
        <div className="toolbar">
          <div className="search">
            <span className="ic"><Search size={16} /></span>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSuggestOpen(true)
                setLocatedId(null)
                setPendingDrawerId(null)
                setSelectedNameEntry(null)
              }}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => setTimeout(() => setSuggestOpen(false), 180)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') clearSearch()
                if (e.key === 'Enter' && suggestions[0]) {
                  e.preventDefault()
                  if (suggestions[0].kind === 'figure') {
                    selectSearchResult(suggestions[0].figure.id)
                  } else {
                    selectNameIndexResult(suggestions[0].entry)
                  }
                }
              }}
              placeholder={t(searchPlaceholder)}
              aria-label={t(searchPlaceholder)}
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                aria-label={t('清除搜索')}
                title={t('清除搜索')}
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearSearch}
              >
                <X size={15} />
              </button>
            )}
            {suggestOpen && (query || searchHistory.length > 0 || hotSearches.length > 0) && (
              <div className="suggest">
                {query ? (
                  suggestions.length ? (
                    suggestions.map((result) => {
                      if (result.kind === 'figure') {
                        const c = result.figure
                        return (
                          <button
                            type="button"
                            className="suggest-item"
                            key={`figure-${c.id}`}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              selectSearchResult(c.id)
                            }}
                          >
                            <span className="dot" style={{ background: facColor(c.faction_id) }} />
                            <span className="suggest-person">
                              <span className="suggest-person-main">
                                <b>{name(c)}</b>
                                <span className="suggest-copy">
                                  {[secondary(c), c.name_roman, c.domain].filter(Boolean).join(' · ')}
                                </span>
                              </span>
                              {c.aliases && c.aliases.length > 0 && (
                                <span className="suggest-aliases">
                                  <em>{t('别名')}</em>
                                  <span>{c.aliases.join(' / ')}</span>
                                </span>
                              )}
                            </span>
                          </button>
                        )
                      }
                      const entry = result.entry
                      return (
                        <button
                          type="button"
                          className="suggest-item name-index"
                          key={`name-${entry.id}`}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            selectNameIndexResult(entry)
                          }}
                        >
                          <span className="name-kind">
                            {t(NAME_INDEX_CATEGORY_LABELS[entry.category])}
                          </span>
                          <b>{entry.name_zh}</b>
                          <span className="suggest-copy">
                            {[entry.name_en, entry.description].filter(Boolean).join(' · ')}
                          </span>
                        </button>
                      )
                    })
                  ) : (
                    <div className="suggest-empty">{t('无结果')}</div>
                  )
                ) : (
                  <div className="search-discovery">
                    {searchHistory.length > 0 && (
                      <section className="search-memory">
                        <div className="search-memory-title">
                          <span><Clock3 size={14} />{t('最近搜索')}</span>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={clearSearchHistory}
                            title={t('清除搜索历史')}
                          >
                            <Trash2 size={13} />{t('清除')}
                          </button>
                        </div>
                        <div className="search-term-list">
                          {searchHistory.map((term) => (
                            <button
                              type="button"
                              key={term}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => searchFromSavedTerm(term)}
                            >
                              {term}
                            </button>
                          ))}
                        </div>
                      </section>
                    )}
                    {hotSearches.length > 0 && (
                      <section className="search-memory hot">
                        <div className="search-memory-title">
                          <span><TrendingUp size={14} />{t('热门搜索')}</span>
                          <small>{t('按查询次数排序')}</small>
                        </div>
                        <div className="search-term-list">
                          {hotSearches.map((item, index) => (
                            <button
                              type="button"
                              key={hotTerm(item.term)}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => searchFromSavedTerm(hotTerm(item.term))}
                            >
                              <i>{index + 1}</i>
                              <span>{hotTerm(item.term)}</span>
                              <small>{item.count > 999 ? '999+' : item.count}</small>
                            </button>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {selectedNameEntry && (
            <aside className="name-index-detail" aria-live="polite">
              <div>
                <span className="name-kind">
                  {t(NAME_INDEX_CATEGORY_LABELS[selectedNameEntry.category])}
                </span>
                <b>{selectedNameEntry.name_zh}</b>
                {selectedNameEntry.name_en && <i>{selectedNameEntry.name_en}</i>}
              </div>
              <p>{selectedNameEntry.description}</p>
              <small>{t("来源：")}{selectedNameEntry.source_label}</small>
              <button
                type="button"
                aria-label={t('关闭专名释义')}
                title={t('关闭专名释义')}
                onClick={() => setSelectedNameEntry(null)}
              >
                <X size={14} />
              </button>
            </aside>
          )}
          <div className="seg">
            <button className={view === 'war' ? 'on' : ''} onClick={() => setView('war')}><Swords size={15} />{t('阵营关系图')}</button>
            <button className={view === 'tree' ? 'on' : ''} onClick={() => setView('tree')}><Network size={15} />{t('神话谱系图')}</button>
          </div>
          <div className="figure-count" aria-live="polite">
            <Users size={15} />
            {view === 'war' ? (
              warFigureCounts.visible === warFigureCounts.total
                ? <>{en ? '' : '共 '}<b>{warFigureCounts.total}</b>{en ? ' characters' : ' 位人物'}</>
                : <>{en ? 'Showing ' : '显示 '}<b>{warFigureCounts.visible}</b> / {warFigureCounts.total}</>
            ) : (
              <>{en ? '' : '共 '}<b>{figures.length}</b>{en ? ' characters' : ' 位人物'}</>
            )}
          </div>
        </div>
        {view === 'war' && (
          <div className="control-row jump-row">
            <span className="control-label"><Navigation size={14} />{t('快速定位')}</span>
            <nav className="section-nav" aria-label={t('阵营关系图区块导航')}>
              {sectionNavItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={activeSectionId === item.id ? 'active' : ''}
                  disabled={!item.visible}
                  aria-current={activeSectionId === item.id ? 'location' : undefined}
                  onClick={() => scrollToSection(item.id)}
                >
                  {t(item.label)}
                  <small>{item.visible}</small>
                </button>
              ))}
            </nav>
          </div>
        )}
        <div className="control-row filter-row">
          <details className="legend-disclosure" onToggle={() => setResizeTick(value => value + 1)}>
          <summary><Palette size={14} /> {en ? `Legend (${factions.length} categories · ${figures.length} characters)` : `阵营图例（${factions.length} 类 · ${figures.length} 人物）`}</summary>
          <div className="chips" aria-label={t('人物类别颜色图例')}>
            {factions.map((f) => (
              <span key={f.id} className="chip">
                <span className="d" style={{ background: facColor(f.id) }} />
                <b>{facLabel(f.id)}</b>
                <small>{facCounts[f.id] || 0}</small>
              </span>
            ))}
          </div>
          </details>
        </div>
      </header>

      <main className="hg-main" onClick={handleCanvasClick}>
        <div className="graph-tools" aria-label={en ? `${zoomViewLabel} zoom controls` : `${zoomViewLabel}缩放控制`}>
          <span className="graph-tools-label">{zoomViewLabel}</span>
          <div className="zoom-controls">
            <button
              type="button"
              onClick={() => changeZoom(-0.1)}
              disabled={activeZoom <= 0.7}
              aria-label={t('缩小视图')}
              title={t('缩小')}
            >
              <ZoomOut size={14} />
            </button>
            <output aria-live="polite">{Math.round(activeZoom * 100)}%</output>
            <button
              type="button"
              onClick={() => changeZoom(0.1)}
              disabled={activeZoom >= 1.5}
              aria-label={t('放大视图')}
              title={t('放大')}
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              className="zoom-reset"
              onClick={resetZoom}
              disabled={activeZoom === 1}
              title={t('恢复到 100%')}
            >
              <RotateCcw size={13} />{t('重置')}
            </button>
          </div>
        </div>
        {view === 'war' ? (
          <div className="zoom-viewport">
            <div className="lanes zoom-surface" ref={lanesRef} style={zoomSurfaceStyle}>
              <svg className="edges">
                <defs>
                  {/* 箭头随线色(context-stroke),用于方向性关系的冗余编码 */}
                  <marker
                    id="hg-arrow"
                    viewBox="0 0 10 10"
                    refX="8.5"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                  >
                    <path d="M0.5,0.5 L9.5,5 L0.5,9.5 Z" fill="context-stroke" />
                  </marker>
                </defs>
                {edges.map((e, i) => (
                  <g key={i}>
                    <path
                      className="rel-edge"
                      d={e.d}
                      stroke={e.color}
                      markerEnd={e.directional ? 'url(#hg-arrow)' : undefined}
                    />
                    <text
                      className="rel-label"
                      x={e.labelX}
                      y={e.labelY}
                      fill={e.color}
                      textAnchor="middle"
                    >
                      {t(e.label)}
                    </text>
                  </g>
                ))}
              </svg>
              <div className="gods-row">
                {godBlock('倾向希腊的神', groups.greekGods, '助希腊', facColor('greek'), 'war-greek-gods')}
                {godBlock('倾向特洛伊的神', groups.trojanGods, '助特洛伊', facColor('trojan'), 'war-trojan-gods')}
                {godBlock('中立 / 摇摆 / 命运', groups.neutralGods, '中立', facColor('olympian'), 'war-neutral-gods')}
              </div>
              {factionCol('希腊联军 · 阿凯亚人', groups.greekHeroes, facColor('greek'), '希腊', 'war-greek-heroes')}
              {factionCol('特洛伊及其盟军', groups.trojanHeroes, facColor('trojan'), '特洛伊', 'war-trojan-heroes')}
              {groups.odyssey.some(matches) && (
                <div className="gods-row" style={{ marginTop: 6 }}>
                  {factionCol('奥德赛世界 · 伊塔卡与归乡', groups.odyssey, facColor('odyssey'), '奥德赛', 'war-odyssey')}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="famctl">
              <div className="seg treeseg">
                <button className={treeMode === 'layers' ? 'on' : ''} onClick={() => setTreeMode('layers')}>
                  <Network size={15} />{t('全景谱系')}
                </button>
                <button className={treeMode === 'ego' ? 'on' : ''} onClick={() => setTreeMode('ego')}>
                  <Undo2 size={15} />{t('人物谱系')}
                </button>
              </div>
              {treeMode === 'layers' ? (
                <span className="famhint">
                  {en ? 'From Chaos (generation 1), follow the recorded generations downward. Hover to highlight direct relatives; select a character for details.' : '从混沌之神(第 1 代)自上而下按代际繁衍展开 · 悬停高亮直系上下游 · 点击查看详情'}
                </span>
              ) : (
                <>
                  <span className="famctl-t">{t('类别')}</span>
                  <select
                    className="focus-category"
                    value={focusFactionId}
                    onChange={(e) => chooseFocusFaction(e.target.value)}
                    aria-label={t('按人物类别筛选焦点')}
                  >
                    <option value="">{en ? 'All' : '全部'} · {figures.length}{en ? '' : '人'}</option>
                    {focusCategoryOptions.map((faction) => (
                      <option key={faction.id} value={faction.id}>
                        {facLabel(faction.id)} · {facCounts[faction.id] || 0}{en ? '' : '人'}
                      </option>
                    ))}
                  </select>
                  <span className="famctl-t">{t('焦点')}</span>
                  <select
                    className="focus-person"
                    value={focusId}
                    onChange={(e) => chooseFocusFigure(e.target.value)}
                    aria-label={t('选择焦点人物')}
                  >
                    {focusOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {genOf(c.id) != null ? `${generation(genOf(c.id))} · ` : ''}
                        {name(c)}
                        {secondary(c) ? ` / ${secondary(c)}` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="focus-reset"
                    disabled={focusId === 'zeus' && !focusFactionId && famHist.length === 0}
                    title={t('恢复到全部类别、宙斯焦点')}
                    onClick={resetFocus}
                  >
                    <RotateCcw size={13} />{t('恢复默认')}
                  </button>
                  {focusId && <div className="crumb" aria-label={t('从最早祖先到焦点人物的血缘主链')}>
                    <span className="crumb-label">{t('血缘主链')}</span>
                    {focusAncestryPath.map((id, index) => {
                      const isRoot = index === 0
                      const isFocus = id === focusId
                      return (
                        <React.Fragment key={id}>
                          {index > 0 && <span className="sep">›</span>}
                          {isFocus ? (
                            <b>{name(byId[id])}</b>
                          ) : (
                            <button
                              type="button"
                              className={isRoot ? 'origin' : ''}
                              title={isRoot ? `${name(byId[id])} · ${byId[id]?.domain || t('最早已录入祖先')}` : en ? `Focus on ${name(byId[id])}` : `聚焦到${name(byId[id])}`}
                              onClick={() => setFocus(id)}
                            >
                              {isRoot && <span>{t('起源')}</span>}
                              {name(byId[id])}
                            </button>
                          )}
                        </React.Fragment>
                      )
                    })}
                    {famHist.length > 0 && (
                      <button type="button" className="crumb-back" onClick={() => goBack('__prev')}>
                        <Undo2 size={12} />{t('返回')}
                      </button>
                    )}
                  </div>}
                </>
              )}
            </div>
            <div className="zoom-viewport">
              {treeMode === 'layers' || !focusId
                ? treeContent()
                : <div className="family zoom-surface" ref={familyRef} style={zoomSurfaceStyle}>{familyContent()}</div>}
            </div>
          </div>
        )}
      </main>

      <div
        className={`scrim${selectedId ? ' show' : ''}`}
        onClick={() => {
          closeDrawer()
          clearRelationHighlight()
        }}
      />
      <aside ref={drawerRef} className={`drawer${selectedId ? ' show' : ''}`} role={selectedId ? 'dialog' : undefined} aria-modal={selectedId ? true : undefined} aria-label={selectedId ? (en ? `${name(byId[selectedId])} details` : `${byId[selectedId]?.name_zh}人物详情`) : undefined} inert={!selectedId}>{drawerContent()}</aside>
    </div>
  )
}

// =========================================================================
// 配色体系 · 中性灰 + 酒红品牌强调色，与标题横幅保持统一；
// 仅浅色主题。分类色(阵营/关系)仍取自 ./palette 的精修谱系。
// 全部选择器加 .hg 前缀以隔离到本页面,避免污染站点全局样式。
// =========================================================================
const HG_CSS = `
.hg{
  /* 酒红色取自标题横幅，界面状态色与页面主视觉保持一致 */
  --bg:#fbf5f6;          /* 标题酒红的极浅色阶 */
  --bg-dot:#eadde0;      /* 与底色同色相的点阵 */
  --bg2:#ffffff;
  --panel:#ffffff;--panel2:#f9fafb;   /* gray-50 */
  --line:#e5e7eb;        /* gray-200 边框 */
  --ink:#111827;--text:#374151;--muted:#6b7280;  /* gray-900 / 700 / 500 */
  --accent:#9f3449;      /* 酒红主强调色 */
  --accent-soft:rgba(159,52,73,.16); /* 酒红柔光/聚焦环 */
  --neutral:#94a3b8;     /* slate-400 婚配连接线 */
  --headbg:rgba(255,255,255,.9);
  --fambg:#f8fafc;       /* slate-50 家系图面板 */
  --famglow:rgba(159,52,73,.10);      /* 酒红柔光 */
  --shadow:rgba(15,23,42,.12);        /* slate-900 alpha 阴影 */
  --page-gutter:clamp(32px,3.5vw,72px);
  color:var(--ink);
  /* 继承站点 body 字体(Inter + 系统中文回退),与西方哲学史等页面统一 */
  font-family:inherit;
  background:var(--bg);
  width:100%;max-width:100%;min-height:100vh;position:relative;
}
.hg *{box-sizing:border-box}
.hg a{color:inherit}
.hg .project-links{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:flex-end}
.hg .project-links>a,.hg .project-links>button{color:inherit;font:inherit;font-size:12px;border:1px solid #ffffff66;border-radius:6px;background:transparent;padding:7px 9px;text-decoration:none;cursor:pointer}
.hg .project-links a:hover,.hg .project-links button:hover{background:#ffffff20}
.hg .share-result{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px var(--page-gutter);font-size:13px;background:var(--accent-soft)}
.hg .share-result input{flex:1;min-width:180px;padding:8px;border:1px solid var(--line);border-radius:6px}
.hg .person-share{margin-top:10px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--accent);font-size:12px;padding:6px 9px;cursor:pointer}
.hg .person-share-result{display:grid;gap:5px;margin-top:8px;color:var(--accent)}
.hg .person-share-result input{width:100%;min-width:0;padding:6px;border:1px solid var(--line);border-radius:5px;font-size:11px}
.hg .legend-disclosure{width:100%}
.hg .legend-disclosure summary{cursor:pointer;color:var(--muted);font-size:12px;line-height:24px}
.hg .legend-disclosure summary svg{vertical-align:middle;margin-inline:4px}
.hg .legend-disclosure[open] .chips{margin-top:8px}
@media(max-width:700px){.hg .hg-hero{flex-wrap:wrap}.hg .project-links{justify-content:flex-start}.hg .project-links .hero-back{font-size:12px;padding:7px 9px}}
/* 渐变标题横幅:沿用之前的酒红色主色调 */
.hg .hg-hero{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px var(--page-gutter);color:#fff;background:linear-gradient(100deg,#a5384a 0%,#7c2f43 100%);box-shadow:0 6px 20px var(--shadow)}
.hg .hg-hero .htxt{flex:1;min-width:0}
.hg .hg-hero .htxt h1{display:flex;align-items:center;gap:10px;margin:0;font-size:clamp(20px,3vw,30px);font-weight:800;letter-spacing:.5px;color:#fff;line-height:1.2}
.hg .hg-hero .htxt p{margin:6px 0 0;font-size:13.5px;color:rgba(255,255,255,.85)}
.hg .hg-hero .hero-back{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;color:#fff;text-decoration:none;font-size:14px;padding:8px 14px;border-radius:8px;border:0;background:transparent;transition:background .2s;flex-shrink:0}
.hg .hg-hero .hero-back:hover{background:rgba(255,255,255,.2)}

.hg .hg-header{position:sticky;top:0;z-index:40;backdrop-filter:blur(8px);background:var(--headbg);border-bottom:1px solid var(--line);padding:14px var(--page-gutter)}
.hg .toolbar{display:flex;gap:12px;align-items:center;margin-top:0;flex-wrap:wrap}
.hg .search{position:relative;flex:1 1 680px;min-width:360px;max-width:760px}
.hg .search input{width:100%;padding:10px 38px 10px 38px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font-size:14px;outline:none}
.hg .search input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.hg .search .ic{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted)}
.hg .search-clear{position:absolute;right:9px;top:50%;z-index:2;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;transform:translateY(-50%);border:0;border-radius:6px;background:transparent;color:var(--muted);cursor:pointer}
.hg .search-clear:hover{background:var(--accent-soft);color:var(--accent)}
.hg .search-clear:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.hg .suggest{position:absolute;top:44px;left:0;right:0;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;box-shadow:0 18px 40px var(--shadow);z-index:60;max-height:340px;overflow-y:auto}
.hg .suggest .suggest-item,.hg .suggest-empty{width:100%;padding:9px 14px;border:0;background:var(--panel);color:var(--ink);font:inherit;font-size:13.5px;display:flex;gap:8px;align-items:center;text-align:left}
.hg .suggest .suggest-item{cursor:pointer}
.hg .suggest .suggest-item:hover,.hg .suggest .suggest-item:focus-visible{background:color-mix(in srgb,var(--accent) 14%,var(--panel));outline:none}
.hg .suggest .dot{flex:0 0 auto;width:8px;height:8px;border-radius:50%}
.hg .suggest-person{display:flex;min-width:0;flex:1;flex-direction:column;gap:3px}
.hg .suggest-person-main{display:flex;min-width:0;align-items:baseline;gap:8px}
.hg .suggest-person-main b{flex:0 0 auto}
.hg .suggest .suggest-copy{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)}
.hg .suggest-aliases{display:flex;min-width:0;align-items:center;gap:6px;color:var(--muted);font-size:11px;line-height:1.35}
.hg .suggest-aliases em{flex:0 0 auto;padding:1px 5px;border-radius:4px;background:var(--accent-soft);color:var(--accent);font-size:9px;font-style:normal;font-weight:800}
.hg .suggest-aliases span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hg .name-kind{flex:0 0 auto;padding:2px 5px;border-radius:5px;background:var(--accent-soft);color:var(--accent);font-size:9px;font-weight:800;line-height:1.35}
.hg .suggest .name-index{gap:7px}
.hg .suggest .name-index b{flex:0 0 auto}
.hg .suggest-empty{color:var(--muted)}
.hg .name-index-detail{position:relative;flex:1 0 100%;padding:10px 36px 10px 12px;border:1px solid color-mix(in srgb,var(--accent) 28%,var(--line));border-radius:9px;background:color-mix(in srgb,var(--accent) 5%,var(--panel));color:var(--text)}
.hg .name-index-detail>div{display:flex;align-items:center;gap:8px}
.hg .name-index-detail b{font-size:13px}
.hg .name-index-detail i{color:var(--muted);font-size:11.5px}
.hg .name-index-detail p{margin:5px 0 3px;font-size:12px;line-height:1.55}
.hg .name-index-detail small{color:var(--muted);font-size:9.5px}
.hg .name-index-detail>button{position:absolute;top:8px;right:8px;display:grid;place-items:center;width:24px;height:24px;border:0;border-radius:6px;background:transparent;color:var(--muted);cursor:pointer}
.hg .name-index-detail>button:hover{background:var(--accent-soft);color:var(--accent)}
.hg .search-discovery{padding:5px 0}
.hg .search-memory{padding:9px 12px}
.hg .search-memory+.search-memory{border-top:1px solid var(--line)}
.hg .search-memory-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;color:var(--text);font-size:11.5px;font-weight:700}
.hg .search-memory-title>span{display:inline-flex;align-items:center;gap:6px}
.hg .search-memory-title svg{color:var(--accent)}
.hg .search-memory-title>small{color:var(--muted);font-size:9.5px;font-weight:500}
.hg .search-memory-title>button{display:inline-flex;align-items:center;gap:4px;padding:3px 5px;border:0;border-radius:5px;background:transparent;color:var(--muted);font:inherit;font-size:10px;cursor:pointer}
.hg .search-memory-title>button:hover{background:var(--accent-soft);color:var(--accent)}
.hg .search-term-list{display:flex;flex-wrap:wrap;gap:6px}
.hg .search-term-list>button{display:inline-flex;align-items:center;gap:5px;max-width:100%;padding:5px 9px;border:1px solid var(--line);border-radius:15px;background:var(--panel2);color:var(--text);font:inherit;font-size:11px;cursor:pointer}
.hg .search-term-list>button:hover{border-color:color-mix(in srgb,var(--accent) 45%,var(--line));background:var(--accent-soft);color:var(--accent)}
.hg .search-term-list>button:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.hg .search-memory.hot .search-term-list>button i{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;background:color-mix(in srgb,var(--accent) 12%,var(--panel));color:var(--accent);font-size:8.5px;font-style:normal;font-weight:800}
.hg .search-memory.hot .search-term-list>button:nth-child(-n+3) i{background:var(--accent);color:#fff}
.hg .search-memory.hot .search-term-list>button small{color:var(--muted);font-size:9px;font-variant-numeric:tabular-nums}
.hg .seg{display:flex;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.hg .seg button{display:inline-flex;align-items:center;gap:6px;background:none;border:0;color:var(--muted);padding:9px 16px;cursor:pointer;font-size:13.5px}
.hg .seg button.on{background:var(--accent);color:#fff;font-weight:700}
.hg .figure-count{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:8px 12px;border:1px solid color-mix(in srgb,var(--accent) 25%,var(--line));border-radius:10px;background:color-mix(in srgb,var(--accent) 6%,var(--panel));color:var(--muted);font-size:12.5px;white-space:nowrap}
.hg .figure-count svg{color:var(--accent)}
.hg .figure-count b{color:var(--ink);font-size:14px}
.hg .control-row{display:flex;align-items:flex-start;gap:12px;margin-top:11px;min-width:0}
.hg .control-label{display:inline-flex;align-items:center;gap:5px;flex:0 0 78px;padding-top:6px;color:var(--muted);font-size:11.5px;font-weight:700;white-space:nowrap}
.hg .control-label svg{color:var(--accent)}
.hg .section-nav{display:flex;gap:7px;min-width:0;overflow-x:auto;padding:1px 2px 4px;scrollbar-width:none}
.hg .section-nav::-webkit-scrollbar{display:none}
.hg .section-nav button{display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;padding:5px 10px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--text);font:inherit;font-size:12px;font-weight:600;cursor:pointer;transition:background .15s,border-color .15s,color .15s,box-shadow .15s}
.hg .section-nav button:hover{border-color:color-mix(in srgb,var(--accent) 45%,var(--line));color:var(--accent)}
.hg .section-nav button.active{border-color:color-mix(in srgb,var(--accent) 42%,var(--line));background:color-mix(in srgb,var(--accent) 10%,var(--panel));color:var(--accent);box-shadow:inset 0 -2px 0 var(--accent)}
.hg .section-nav button:disabled{cursor:not-allowed;opacity:.35;box-shadow:none}
.hg .section-nav button small{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--panel2);color:var(--muted);font-size:10px;font-weight:700}
.hg .section-nav button.active small{background:var(--panel);color:var(--accent)}
.hg .section-nav button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.hg .chips{display:flex;gap:8px;flex-wrap:wrap;min-width:0}
.hg .chip{display:flex;align-items:center;gap:6px;padding:5px 11px;border-radius:20px;font-family:inherit;color:var(--ink);font-size:12.5px;border:1px solid var(--line);background:var(--panel);cursor:default;user-select:none}
.hg .chip .d{width:10px;height:10px;border-radius:50%}
.hg .chip b{font-weight:600}
.hg .chip small{color:var(--muted)}
/* 点阵纹路背景:对齐西方哲学史(ReactFlow Dots · #e5e7eb · gap 24 · size 1.5) */
.hg .hg-main{width:100%;max-width:100%;padding:20px var(--page-gutter) 80px;background-color:var(--bg);background-image:radial-gradient(var(--bg-dot) 1.2px,transparent 1.2px);background-size:24px 24px}
.hg .graph-tools{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin:0 0 12px}
.hg .graph-tools-label{color:var(--muted);font-size:11px;font-weight:700}
.hg .zoom-controls{display:inline-flex;align-items:center;overflow:hidden;border:1px solid var(--line);border-radius:9px;background:var(--panel);box-shadow:0 2px 5px rgba(15,23,42,.06)}
.hg .zoom-controls button{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:32px;height:32px;padding:0 9px;border:0;border-right:1px solid var(--line);background:transparent;color:var(--text);font:inherit;font-size:11px;font-weight:700;cursor:pointer}
.hg .zoom-controls button:hover:not(:disabled){background:var(--accent-soft);color:var(--accent)}
.hg .zoom-controls button:focus-visible{position:relative;z-index:1;outline:2px solid var(--accent);outline-offset:-2px}
.hg .zoom-controls button:disabled{opacity:.35;cursor:default}
.hg .zoom-controls output{min-width:50px;padding:0 8px;color:var(--ink);font-size:11px;font-variant-numeric:tabular-nums;text-align:center}
.hg .zoom-controls .zoom-reset{border-right:0;border-left:1px solid var(--line)}
.hg .zoom-viewport{width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;padding:4px 4px 12px;overscroll-behavior-x:contain;scrollbar-color:color-mix(in srgb,var(--accent) 30%,var(--line)) transparent}
.hg .zoom-surface{zoom:var(--hg-zoom,1);transform-origin:top left}
.hg .lanes{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:26px;position:relative}
.hg .lanes>div{min-width:0}
.hg .lane-title{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:700;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid var(--line)}
.hg .badge{font-size:11px;padding:2px 8px;border-radius:8px;border:1px solid transparent;font-weight:600}
.hg .gods-row{grid-column:1 / -1;margin-bottom:10px}
.hg [data-war-section]{scroll-margin-top:190px}
.hg .group{margin-bottom:20px}
.hg .group h4{font-size:12.5px;color:var(--muted);margin:0 0 9px;font-weight:600;display:flex;align-items:center;gap:8px}
.hg .group h4:before{content:"";width:6px;height:6px;background:var(--accent);border-radius:50%}
.hg .grid{display:grid;width:100%;min-width:0;grid-template-columns:repeat(auto-fill,minmax(min(190px,100%),1fr));gap:12px}
.hg .card{width:100%;min-width:0;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;cursor:pointer;transition:transform .3s,box-shadow .3s;position:relative;box-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1)}
.hg .card:hover{transform:scale(1.05);box-shadow:none}
.hg .card.dim{opacity:.25;filter:grayscale(1)}
.hg .card.hot{box-shadow:0 0 0 3px var(--accent-soft),0 8px 20px rgba(15,23,42,.16)}
.hg .card .bar{height:3px}
.hg .card .body{padding:12px 12px 12px}
.hg .card .zh{font-size:14px;font-weight:700;line-height:1.2;color:var(--ink)}
.hg .card .en{font-size:11px;color:var(--muted);font-style:italic;margin-top:2px;min-height:14px}
.hg .card .dom{display:inline-block;margin-top:8px;font-size:10.5px;padding:2px 8px;border-radius:4px;border:1px solid transparent;font-weight:500}
.hg .card .ep{margin-top:9px;font-size:11px;color:var(--text);line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hg .card .roman{display:inline-flex;align-items:center;gap:3px;position:absolute;top:8px;right:10px;font-size:10px;color:var(--muted)}
/* 代际标签(卡片):第N代 chip + 神族·第k代 次要文字 */
.hg .card .gen{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px}
.hg .gen .g1{font-size:10.5px;font-weight:700;color:var(--ink);background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:1px 6px;line-height:1.5}
.hg .gen .g2{font-size:10.5px;font-weight:600}
.hg .fc .fgen{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:3px}
.hg .fc .fgen .g1{font-size:9.5px;font-weight:700;color:var(--ink);background:var(--panel2);border:1px solid var(--line);border-radius:5px;padding:0 5px}
.hg .fc .fgen .g2{font-size:9.5px;color:var(--muted)}
.hg .edges{position:absolute;inset:0;pointer-events:none;z-index:3;overflow:visible;width:100%;height:100%}
.hg .edges .rel-edge{fill:none;stroke-width:2.2;opacity:.9}
.hg .edges .rel-label{font-size:10px;font-weight:800;paint-order:stroke;stroke:var(--panel);stroke-width:4px;stroke-linejoin:round}
.hg .famctl{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.hg .famctl-t{display:inline-flex;align-items:center;gap:6px;font-weight:700}
.hg .famctl select{background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:8px 12px;font-size:14px;outline:none}
.hg .famctl select:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.hg .famctl .focus-category{width:170px}
.hg .famctl .focus-person{width:min(300px,100%)}
.hg .focus-reset{display:inline-flex;align-items:center;gap:5px;min-height:36px;padding:7px 10px;border:1px solid color-mix(in srgb,var(--accent) 35%,var(--line));border-radius:8px;background:color-mix(in srgb,var(--accent) 6%,var(--panel));color:var(--accent);font:inherit;font-size:11.5px;font-weight:700;white-space:nowrap;cursor:pointer}
.hg .focus-reset:hover:not(:disabled){background:color-mix(in srgb,var(--accent) 12%,var(--panel))}
.hg .focus-reset:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.hg .focus-reset:disabled{opacity:.38;cursor:default}
.hg .famhint{color:var(--muted);font-size:12px}
.hg .crumb{display:flex;align-items:center;gap:6px;flex:1 1 480px;min-width:0;flex-wrap:wrap;font-size:12.5px}
.hg .crumb .crumb-label{padding-right:2px;color:var(--muted);font-size:10.5px;font-weight:700;letter-spacing:.5px}
.hg .crumb button{display:inline-flex;align-items:center;gap:4px;padding:0;border:0;background:none;color:var(--accent);font:inherit;cursor:pointer;text-decoration:underline}
.hg .crumb button.origin span{padding:1px 5px;border-radius:5px;background:var(--accent-soft);font-size:9px;font-weight:700;text-decoration:none}
.hg .crumb button.crumb-back{margin-left:5px;text-decoration:none}
.hg .crumb button:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:3px}
.hg .crumb span.sep{color:var(--muted)}
.hg .family{position:relative;border:1px solid var(--line);border-radius:16px;background:radial-gradient(600px 300px at 50% 0,var(--famglow) 0,transparent 70%),var(--fambg);padding:20px 22px 28px;overflow:hidden}
.hg .fedges{position:absolute;inset:0;pointer-events:none;z-index:1;overflow:visible;width:100%;height:100%}
.hg .fedges path{fill:none;stroke:var(--neutral);stroke-width:1.35;opacity:.42}
.hg .fedges path.hot{stroke:var(--accent);stroke-width:2.2;opacity:.95}
.hg .fedges .fedge-label{fill:var(--accent);font-size:10px;font-weight:800;paint-order:stroke;stroke:var(--panel);stroke-width:5px;stroke-linejoin:round}
.hg .ego-summary{position:relative;z-index:2;display:flex;align-items:baseline;justify-content:center;gap:10px;flex-wrap:wrap;margin:0 0 12px;padding:0 0 12px;border-bottom:1px solid var(--line);text-align:center}
.hg .ego-summary b{font-size:13px;color:var(--accent)}
.hg .ego-summary span{font-size:11px;color:var(--muted)}
.hg .ego-row{position:relative;z-index:2;display:flex;align-items:flex-start;gap:16px;padding:14px 0;border-bottom:1px dashed var(--line)}
.hg .ego-row:last-child{border-bottom:0}
.hg .ego-label{flex:0 0 92px;position:sticky;left:0;display:flex;flex-direction:column;gap:3px;padding:5px 8px;border-radius:8px;background:color-mix(in srgb,var(--fambg) 92%,transparent)}
.hg .ego-label b{font-size:12px;color:var(--accent);white-space:nowrap}
.hg .ego-label span{font-size:9.5px;color:var(--muted);white-space:nowrap}
.hg .ego-label.muted b{color:var(--muted)}
.hg .ego-cards{flex:1;min-width:0;display:flex;justify-content:center;align-items:stretch;gap:12px;flex-wrap:wrap}
.hg .fam-section{margin-bottom:8px}
.hg .fam-lbl{text-align:center;color:var(--accent);font-size:11.5px;letter-spacing:2px;margin:0 0 10px}
.hg .fam-row{display:flex;justify-content:center;align-items:stretch;gap:14px;flex-wrap:wrap}
.hg .fam-conn{width:2px;height:26px;background:var(--accent);margin:0 auto;opacity:.5}
.hg .couple{display:flex;align-items:center;gap:0}
.hg .couple .marr{width:26px;height:2px;background:var(--neutral);position:relative}
.hg .couple .marr:after{content:"⚭";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:var(--neutral);font-size:15px;background:var(--fambg);padding:0 2px}
.hg .fc{background:var(--panel);border:1px solid var(--line);border-radius:8px;width:150px;cursor:pointer;transition:transform .3s,box-shadow .3s,opacity .2s,filter .2s;overflow:hidden;position:relative;flex-shrink:0;box-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1)}
.hg .fc:hover{transform:scale(1.05);box-shadow:none}
.hg .fc.dim{opacity:.25;filter:grayscale(.75)}
.hg .fc.hot{box-shadow:0 0 0 3px var(--accent-soft),0 8px 18px rgba(0,0,0,.16)}
.hg .fc .b{height:3px}
.hg .fc .in{padding:8px 10px}
.hg .fc .z{padding-right:48px;font-size:14px;font-weight:700;line-height:1.15}
.hg .fc .en{min-height:13px;margin-top:1px;color:var(--muted);font-size:9.5px;font-style:italic;line-height:1.25}
.hg .fc .roman{display:inline-flex;align-items:center;gap:2px;position:absolute;top:7px;right:7px;max-width:62px;overflow:hidden;color:var(--muted);font-size:8.5px;white-space:nowrap;text-overflow:ellipsis}
.hg .fc .frole{position:absolute;top:25px;right:7px;padding:1px 5px;border-radius:5px;background:var(--accent-soft);color:var(--accent);font-size:8.5px;font-weight:700}
.hg .fc .d{font-size:10.5px;color:var(--muted);margin-top:2px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hg .fc.big{width:186px;box-shadow:0 0 0 3px var(--accent-soft),0 8px 22px rgba(0,0,0,.16)}
.hg .fc.big .z{font-size:17px}
.hg .fc.big .in{padding:11px 13px}
.hg .fc.mini{width:132px}
.hg .fc.mini .z{font-size:12.5px}
.hg .fc.context{border-style:dashed;box-shadow:0 2px 5px rgba(0,0,0,.07)}
.hg .partners{display:flex;gap:16px;overflow-x:auto;padding:6px 2px 12px;align-items:flex-start}
.hg .pcol{border:1px dashed var(--line);border-radius:14px;padding:12px 12px 14px;background:rgba(255,255,255,.02);display:flex;flex-direction:column;align-items:center;gap:0;flex-shrink:0}
.hg .pcol .ptag{font-size:10.5px;color:var(--muted);margin:6px 0 2px}
.hg .pcol .kids{display:flex;flex-direction:column;gap:8px;margin-top:6px}
.hg .pcol .nokid{color:var(--muted);font-size:11px;margin-top:8px}
.hg .kbrace{width:2px;height:16px;background:var(--accent);opacity:.45;margin:2px auto}
.hg .fam-empty{color:var(--muted);text-align:center;padding:30px}
/* ===== 全景谱系(从混沌自上而下) ===== */
.hg .seg.treeseg{margin-right:4px}
.hg .tree{position:relative;border:1px solid var(--line);border-radius:16px;background:radial-gradient(700px 320px at 50% 0,var(--famglow) 0,transparent 70%),var(--fambg);padding:20px 20px 30px}
.hg .tedges{position:absolute;inset:0;pointer-events:none;z-index:1;overflow:visible;width:100%;height:100%}
.hg .tedges .te{stroke:var(--neutral);stroke-width:1.4;opacity:.35}
.hg .tedges .te.hot{stroke:var(--accent);stroke-width:2.2;opacity:.95}
.hg .tedges .te-label{fill:var(--accent);font-size:10px;font-weight:800;paint-order:stroke;stroke:var(--panel);stroke-width:5px;stroke-linejoin:round}
.hg .trow{position:relative;z-index:2;display:flex;align-items:flex-start;gap:14px;padding:10px 0;border-bottom:1px dashed var(--line)}
.hg .trow:last-child{border-bottom:0}
.hg .tlabel{flex:0 0 84px;position:sticky;left:0;display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding-top:4px}
.hg .tlabel .tg{font-size:12.5px;font-weight:800;color:var(--accent);white-space:nowrap}
.hg .tlabel .tg.muted{color:var(--muted)}
.hg .tlabel .tn{font-size:10.5px;color:var(--muted)}
.hg .tcards{flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:9px;align-content:flex-start}
.hg .tc{background:var(--panel);border:1px solid var(--line);border-radius:8px;width:152px;cursor:pointer;transition:transform .2s,box-shadow .2s,opacity .2s;overflow:hidden;position:relative;flex-shrink:0;box-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1)}
.hg .tc:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(0,0,0,.14)}
.hg .tc.dim{opacity:.28;filter:grayscale(.7)}
.hg .tc.hot{box-shadow:0 0 0 3px var(--accent-soft),0 8px 18px rgba(0,0,0,.16)}
.hg .tc .b{height:3px}
.hg .tc .in{padding:8px 10px 9px}
.hg .tc .z{padding-right:48px;font-size:13px;font-weight:700;line-height:1.2}
.hg .tc .en{min-height:12px;margin-top:1px;color:var(--muted);font-size:9px;font-style:italic;line-height:1.2}
.hg .tc .roman{display:inline-flex;align-items:center;gap:2px;position:absolute;top:7px;right:7px;max-width:52px;overflow:hidden;color:var(--muted);font-size:8px;white-space:nowrap;text-overflow:ellipsis}
.hg .tc .d{font-size:10px;color:var(--muted);margin-top:2px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hg .tc .fr{display:block;margin-top:4px;font-size:9.5px;font-weight:600}
.hg .card.located,.hg .fc.located,.hg .tc.located{position:relative;z-index:5;animation:hg-locate 1.05s ease-in-out 2;box-shadow:0 0 0 4px rgba(159,52,73,.28),0 10px 26px rgba(15,23,42,.2)}
@keyframes hg-locate{
  0%,100%{transform:translateY(0)}
  50%{transform:translateY(-4px);box-shadow:0 0 0 7px rgba(159,52,73,.12),0 12px 30px rgba(15,23,42,.22)}
}
@media (prefers-reduced-motion:reduce){
  .hg .card.located,.hg .fc.located,.hg .tc.located{animation:none}
}
@media (max-width:860px){
  .hg .tree{padding:14px 12px 22px}
  .hg .tlabel{flex-basis:60px}
  .hg .tc{width:124px}
  .hg .ego-row{gap:8px}
  .hg .ego-label{flex-basis:64px;padding-left:3px;padding-right:3px}
  .hg .ego-label span{white-space:normal}
}
.hg .scrim{position:fixed;inset:0;background:rgba(6,10,20,.55);z-index:80;opacity:0;pointer-events:none;transition:.2s}
.hg .scrim.show{opacity:1;pointer-events:auto}
.hg .drawer{position:fixed;top:0;right:0;height:100%;width:min(440px,92vw);background:var(--bg2);z-index:90;border-left:1px solid var(--line);transform:translateX(100%);transition:.28s cubic-bezier(.2,.8,.2,1);display:flex;flex-direction:column}
.hg .drawer.show{transform:none}
.hg .dhead{flex:0 0 auto;padding:20px 22px;border-bottom:1px solid var(--line);position:relative}
.hg .dhead .close{position:absolute;top:16px;right:16px;background:none;border:0;color:var(--muted);font-size:22px;cursor:pointer}
.hg .dhead .fac{display:inline-block;font-size:11px;padding:3px 10px;border-radius:8px;border:1px solid transparent;margin-bottom:10px;font-weight:600}
.hg .dhead .zh{font-size:24px;font-weight:800;margin:0}
.hg .dhead .en{color:var(--muted);font-style:italic;margin-top:3px}
.hg .dhead .alias{margin-top:8px;font-size:12px;color:var(--accent)}
.hg .dhead .variant-note{margin-top:5px;padding:7px 9px;border-left:2px solid color-mix(in srgb,var(--accent) 55%,var(--line));background:color-mix(in srgb,var(--accent) 5%,var(--panel));color:var(--muted);font-size:10px;line-height:1.5}
.hg .dbody{flex:1 1 auto;min-height:0;padding:18px 22px calc(28px + env(safe-area-inset-bottom));overflow-y:auto;overscroll-behavior:contain}
.hg .sec{margin-bottom:20px}
.hg .sec h5{font-size:12px;letter-spacing:1px;color:var(--accent);margin:0 0 8px;text-transform:uppercase}
.hg .sec ul{margin:0;padding-left:18px}
.hg .sec li{font-size:13.5px;line-height:1.7;color:var(--text);margin-bottom:3px}
.hg .kin-graph-scroll{width:100%;overflow-x:auto;padding:8px 0 12px;border:1px solid var(--line);border-radius:12px;background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 5%,var(--panel)) 0,var(--panel) 42%);scrollbar-color:color-mix(in srgb,var(--accent) 35%,var(--line)) transparent}
.hg .kin-graph-canvas{position:relative;min-width:100%}
.hg .kin-lines{position:absolute;inset:0;overflow:visible}
.hg .kin-lines line{stroke:var(--neutral);stroke-width:1.5}
.hg .kin-lines .kin-spouse-line{stroke:var(--accent);stroke-width:1.8}
.hg .kin-lines .kin-sibling-line{stroke:var(--neutral);stroke-dasharray:4 4}
.hg .kin-node{position:absolute;z-index:2;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;width:110px;height:58px;padding:7px 8px;transform:translateX(-50%);overflow:hidden;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink);font:inherit;text-align:left;box-shadow:0 3px 8px rgba(15,23,42,.09);cursor:pointer}
.hg .kin-node:hover:not(:disabled){z-index:3;transform:translateX(-50%) translateY(-2px);border-color:var(--accent);box-shadow:0 6px 14px rgba(15,23,42,.14)}
.hg .kin-node:focus-visible{z-index:4;outline:2px solid var(--accent);outline-offset:2px}
.hg .kin-node.self{border-width:2px;border-color:var(--accent)!important;background:color-mix(in srgb,var(--accent) 7%,var(--panel));cursor:default}
.hg .kin-node.self:disabled{opacity:1;color:var(--ink)}
.hg .kin-node .kin-role{max-width:100%;margin-bottom:1px;color:var(--accent);font-size:8px;font-weight:800;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hg .kin-node b{display:block;max-width:100%;font-size:11.5px;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hg .kin-node small{display:block;max-width:100%;margin-top:1px;color:var(--muted);font-size:8.5px;font-style:italic;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hg .kin-hint{margin:7px 2px 0;color:var(--muted);font-size:9.5px;line-height:1.5}
.hg .relation-empty{padding:14px;border:1px dashed var(--line);border-radius:9px;color:var(--muted);font-size:12px;text-align:center}
.hg .other-relations{margin-top:14px;padding-top:12px;border-top:1px dashed var(--line)}
.hg .other-relations h6{margin:0 0 8px;color:var(--muted);font-size:10px;letter-spacing:.5px}
.hg .rel{display:flex;flex-wrap:wrap;gap:7px}
.hg .relpill{font:inherit;font-size:12px;color:var(--ink);padding:5px 10px;border-radius:8px;background:var(--panel);border:1px solid var(--line);cursor:pointer;display:flex;gap:6px;align-items:center}
.hg .relpill:hover{border-color:var(--accent)}
.hg .relpill .rk{color:var(--muted);font-size:10.5px}
.hg .relpill .d{width:8px;height:8px;border-radius:50%}
.hg .empty{color:var(--muted);text-align:center;padding:60px 20px}
.hg .lang-switch{margin-left:8px}
.hg .translation-note{margin:0 0 18px;padding:10px 12px;background:#fff7e6;border-radius:8px;color:#714c1b;font-size:12px;line-height:1.6}
.hg .translation-note a{color:inherit;text-decoration:underline}
.hg-en .card .zh,.hg-en .fc .z,.hg-en .tc .z{overflow-wrap:anywhere;line-height:1.3}
.hg-en .kin-node b,.hg-en .kin-role{white-space:normal;overflow-wrap:anywhere;line-height:1.25}
.hg-en .project-links{flex-wrap:wrap}
/* ===== 移动端响应式 ===== */
@media (max-width:860px){
  .hg{--page-gutter:clamp(16px,4vw,28px)}
  .hg .hg-hero{padding-top:14px;padding-bottom:14px;gap:10px}
  .hg .hg-hero .htxt p{font-size:11.5px}
  .hg .hg-hero .hero-back{padding:7px 11px;font-size:12.5px}
  .hg .hg-header{padding-top:11px;padding-bottom:11px}
  .hg .toolbar{gap:8px;margin-top:0}
  .hg .search{flex:1 0 100%;max-width:none;min-width:0;order:-1}
  .hg .seg button{padding:8px 11px;font-size:12.5px}
  .hg .figure-count{min-height:35px;padding:7px 10px}
  .hg .control-row{gap:8px;margin-top:9px}
  .hg .control-label{flex-basis:70px}
  .hg .hg-main{padding-top:14px;padding-bottom:80px}
  .hg .lanes{grid-template-columns:1fr;gap:14px}
  .hg .grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
  .hg .card .zh{font-size:13px}
  .hg .family{padding:18px 12px 26px}
  .hg .famctl{gap:8px}
  .hg .famctl select{flex:1 0 100%}
}
@media (max-width:520px){
  .hg .hg-hero{padding:14px 16px;gap:10px}
  .hg .figure-count{display:none}
  .hg .famctl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
  .hg .famctl .treeseg,.hg .famctl .crumb,.hg .famctl .famhint{grid-column:1 / -1}
  .hg .famctl .famctl-t{display:none}
  .hg .famctl select{width:100%;min-width:0}
  .hg .control-row{display:block}
  .hg .control-label{padding-top:0;margin-bottom:6px}
  .hg .section-nav{width:100%}
  .hg .chips{gap:6px}
  .hg .chip{padding:5px 9px;font-size:11.5px}
  .hg .grid{grid-template-columns:1fr 1fr;gap:8px}
  .hg .card .body{padding:9px 10px 10px}
  .hg .card .en{display:none}
  .hg .card .ep{-webkit-line-clamp:3}
  .hg .fc{width:132px}
  .hg .fc.big{width:150px}
  .hg .fc.mini{width:118px}
}
`
