// SPDX-License-Identifier: AGPL-3.0-only
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HomericGraph } from './HomericGraph'
import type { HomericGraph as GraphData } from './types'
import { validateSnapshot } from './snapshot.mjs'
import './styles.css'
import { localePaths } from './i18n/content.mjs'
import { createSharedUrl } from './shared-view.mjs'
import { type Translations } from './i18n'
const paths = localePaths(window.location.pathname)
const locale = paths.locale === 'en' ? 'en' : 'zh'

function App() {
  const [graph, setGraph] = useState<GraphData | null>(null)
  const [translations, setTranslations] = useState<Translations>({})
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    Promise.all([fetch(paths.base + 'data/homeric.json').then(response => {if(!response.ok) throw new Error('snapshot unavailable'); return response.json()}),
      fetch(paths.base + 'data/locales/en.json').then(response => response.ok ? response.json() : {}).catch(() => ({}))])
      .then(([data, english]) => { validateSnapshot(data); if (active) {setTranslations(english); setGraph(data)} })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [])
  if (error) return <p role="alert">{locale === 'en' ? 'Unable to load the map. Refresh or report the problem through GitHub Issues.' : '图谱加载失败，请刷新重试或通过 GitHub Issues 反馈。'}</p>
  if (!graph) return <p role="status">{locale === 'en' ? 'Loading the Homeric Epic Map…' : '正在加载荷马史诗脉络图…'}</p>
  return <HomericGraph graph={graph} locale={locale} translations={translations}
    onLocaleChange={(next,state) => window.location.assign(createSharedUrl(new URL(paths[next],window.location.origin).href,state))} backHref="https://readmap.inklinks.io/" backLabel="阅读路书 ReadMap"
    sourceHref={import.meta.env.VITE_SOURCE_URL || 'https://github.com/adonisly/homeric-epic-map/tree/main'}
    catalogHref={(locale === 'en' ? paths.en : paths.zh) + 'explore/'} feedbackHref="https://github.com/adonisly/homeric-epic-map/issues"
    searchPlaceholder="搜索人物 / 神职 / 称号（中文·拼音·外文名·别名）" />
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
