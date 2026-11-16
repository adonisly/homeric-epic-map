// SPDX-License-Identifier: AGPL-3.0-only
/** @returns {{view: 'war' | 'tree', mode: 'layers' | 'ego', focus: string, figure: string | null, query: string, category?: string}} */
export function parseSharedView(input, validIds, validFactionIds = []) {
  const params = new URL(input).searchParams
  const ids = new Set(validIds)
  return {
    view: params.get('view') === 'war' ? 'war' : 'tree',
    mode: params.get('mode') === 'layers' ? 'layers' : 'ego',
    focus: ids.has(params.get('focus')) ? params.get('focus') : 'zeus',
    figure: ids.has(params.get('figure')) ? params.get('figure') : null,
    query: (params.get('q') || '').slice(0, 100),
    ...(validFactionIds.includes(params.get('category')) ? {category:params.get('category')} : {}),
  }
}

export function createSharedUrl(input, state) {
  const url = new URL(input)
  url.search = ''
  url.hash = ''
  url.searchParams.set('view', state.view === 'war' ? 'war' : 'tree')
  url.searchParams.set('mode', state.mode === 'layers' ? 'layers' : 'ego')
  if (state.focus) url.searchParams.set('focus', state.focus)
  if (state.figure) url.searchParams.set('figure', state.figure)
  if (state.query) url.searchParams.set('q', state.query.slice(0, 100))
  if (state.category) url.searchParams.set('category',state.category.slice(0,100))
  return url.href
}
