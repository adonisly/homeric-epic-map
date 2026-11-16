// SPDX-License-Identifier: AGPL-3.0-only
export const PUBLIC_FIELDS = {
  factions: ['id', 'name_zh', 'name_en', 'color', 'sort_order', 'in_legend'],
  figures: ['id', 'name_zh', 'name_en', 'name_roman', 'gender', 'py', 'aliases', 'faction_id', 'war_side', 'group_label', 'generation', 'domain', 'epithet', 'bio', 'image_url', 'confidence', 'variant_note', 'tags'],
  relations: ['id', 'from_figure_id', 'to_figure_id', 'relation_type', 'description', 'confidence', 'variant_note'],
  relationTypes: ['id', 'value', 'label_zh', 'label_en', 'color', 'is_directional', 'description'],
}

export function projectPublicSnapshot(input) {
  const result = Object.fromEntries(Object.entries(PUBLIC_FIELDS).map(([key, fields]) => [key,
    input[key].map(row => Object.fromEntries(fields.map(field => [field, field === 'image_url' ? null : row[field] ?? null]))),
  ]))
  // Do not redistribute a modern translation's complete proper-name index.
  result.nameIndex = []
  validateSnapshot(result)
  return result
}

export function validateSnapshot(data) {
  const fail = message => { throw new Error('Invalid public snapshot: ' + message) }
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('expected an object')
  const keys = [...Object.keys(PUBLIC_FIELDS), 'nameIndex']
  if (Object.keys(data).some(key => !keys.includes(key))) fail('unexpected top-level field')
  for (const key of keys) if (!Array.isArray(data[key])) fail(key + ' must be an array')
  if (data.nameIndex.length) fail('third-party proper-name index is excluded')
  for (const [key, fields] of Object.entries(PUBLIC_FIELDS)) {
    const ids = new Set()
    for (const row of data[key]) {
      if (!row || Object.keys(row).some(field => !fields.includes(field))) fail('unexpected ' + key + ' field')
      if (fields.some(field => !Object.hasOwn(row, field))) fail('missing ' + key + ' field')
      if (row.id == null || ids.has(row.id)) fail('missing or duplicate ' + key + ' id')
      ids.add(row.id)
    }
  }
  if (!data.figures.length) fail('empty figures')
  const factions = new Set(data.factions.map(row => row.id))
  const figures = new Set(data.figures.map(row => row.id))
  const types = new Set(data.relationTypes.map(row => row.value))
  for (const row of data.figures) {
    if (typeof row.id !== 'string' || !row.name_zh || typeof row.name_zh !== 'string') fail('figure identity')
    if (row.faction_id && !factions.has(row.faction_id)) fail('unresolved faction')
    if (!['male', 'female', 'unknown'].includes(row.gender)) fail('gender')
    if (row.war_side && !['greek', 'trojan', 'neutral'].includes(row.war_side)) fail('war side')
    if (!['standard', 'variant', 'disputed'].includes(row.confidence)) fail('confidence')
    if (row.generation !== null && !Number.isInteger(row.generation)) fail('generation')
    if (row.image_url !== null) fail('unreviewed external image')
    for (const field of ['aliases', 'bio', 'tags']) {
      if (row[field] !== null && (!Array.isArray(row[field]) || row[field].some(value => typeof value !== 'string'))) fail(field)
    }
  }
  for (const row of data.relations) {
    if (!figures.has(row.from_figure_id) || !figures.has(row.to_figure_id)) fail('unresolved relation endpoint')
    if (!types.has(row.relation_type)) fail('unresolved relation type')
  }
  return data
}
