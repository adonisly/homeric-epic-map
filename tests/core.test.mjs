// SPDX-License-Identifier: AGPL-3.0-only
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateSnapshot, projectPublicSnapshot } from '../src/snapshot.mjs'
import { createSharedUrl, parseSharedView } from '../src/shared-view.mjs'
import { buildFigureIndex, scoreFigure } from '../src/search.ts'
import { kinshipRole } from '../src/kinship.ts'
import { createSiteContent } from '../scripts/site-content.mjs'
const snapshot = JSON.parse(readFileSync(new URL('../public/data/homeric.json', import.meta.url)))

test('public snapshot rejects dangling references, private fields and the excluded name index', () => {
  validateSnapshot(snapshot)
  for (const mutate of [d => { d.figures[0].email = 'private' }, d => { d.relations[0].to_figure_id = 'missing' }, d => { d.nameIndex = [{ raw_entry: 'excluded' }] }, d => { d.figures[0].image_url = 'https://example.com/unreviewed.jpg' }]) {
    const copy = structuredClone(snapshot); mutate(copy); assert.throws(() => validateSnapshot(copy))
  }
})
test('projection drops private fields, original index and images', () => {
  const input = structuredClone(snapshot)
  input.figures[0].email = 'private'
  input.figures[0].image_url = 'https://example.com/unreviewed.jpg'
  input.nameIndex = [{ raw_entry: 'excluded' }]
  const output = projectPublicSnapshot(input)
  assert.equal(output.figures[0].email, undefined)
  assert.equal(output.figures[0].image_url, null)
  assert.deepEqual(output.nameIndex, [])
})
test('Chinese, English, Roman, full pinyin and initials find the same figure', () => {
  const zeus = snapshot.figures.find(figure => figure.id === 'zeus')
  for (const query of [zeus.name_zh, zeus.name_en, 'zhousi', 'zs', zeus.name_roman].filter(Boolean)) assert.ok(scoreFigure(buildFigureIndex(zeus), query) > 0, query)
})
test('kinship labels respect gender and unknown fallback', () => {
  assert.equal(kinshipRole('female', 'parent'), '母亲')
  assert.equal(kinshipRole('male', 'child'), '儿子')
  assert.equal(kinshipRole(undefined, 'grandparent'), '祖父母')
})
test('share roundtrip preserves only approved state and host path', () => {
  const state = { view: 'tree', mode: 'ego', focus: 'zeus', figure: 'achilles', query: '阿基琉斯' }
  const url = createSharedUrl('https://example.com/map/?token=private&utm_source=host#secret', state)
  assert.ok(url.startsWith('https://example.com/map/?'))
  assert.ok(!/private|secret|utm_source|token/.test(url))
  assert.deepEqual(parseSharedView(url, snapshot.figures.map(row => row.id)), state)
  const invalid = parseSharedView('https://example.com/?view=invalid&focus=missing&figure=missing&q=' + 'x'.repeat(200), ['zeus'])
  assert.equal(invalid.focus, 'zeus'); assert.equal(invalid.figure, null); assert.equal(invalid.query.length, 100)
})
test('static content escapes data and uses configured domain and subdirectory', () => {
  const copy = structuredClone(snapshot); copy.figures[0].epithet = '<script>alert(1)</script>'
  const site = createSiteContent(copy, 'https://example.com/map/')
  assert.ok(site.assets['explore/index.html'].includes('&lt;script&gt;'))
  assert.ok(!site.assets['explore/index.html'].includes('<script>alert'))
  assert.ok(site.assets['sitemap.xml'].includes('https://example.com/map/explore/'))
  assert.ok(site.head.includes('https://example.com/map/social-preview.png'))
  assert.throws(() => createSiteContent(snapshot, 'javascript:alert(1)'))
})
