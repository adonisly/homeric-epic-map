// SPDX-License-Identifier: AGPL-3.0-only
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HomericGraph } from './HomericGraph'
import type { HomericGraph as GraphData } from './types'
import { validateSnapshot } from './snapshot.mjs'
import './styles.css'

function App() {
  const [graph, setGraph] = useState<GraphData | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    fetch(import.meta.env.BASE_URL + 'data/homeric.json')
      .then(response => { if (!response.ok) throw new Error('snapshot unavailable'); return response.json() })
      .then(data => { validateSnapshot(data); if (active) setGraph(data) })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [])
  if (error) return <p role="alert">图谱加载失败，请刷新重试或通过 GitHub Issues 反馈。</p>
  if (!graph) return <p role="status">正在加载荷马史诗脉络图…</p>
  return <HomericGraph graph={graph} backHref="https://readmap.inklinks.io/" backLabel="阅读路书 ReadMap"
    sourceHref={import.meta.env.VITE_SOURCE_URL || 'https://github.com/adonisly/homeric-epic-map/tree/main'}
    catalogHref={import.meta.env.BASE_URL + 'explore/'} feedbackHref="https://github.com/adonisly/homeric-epic-map/issues"
    searchPlaceholder="搜索人物 / 神职 / 称号（中文·拼音·外文名·别名）" />
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
