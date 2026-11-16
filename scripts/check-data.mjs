// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { validateSnapshot } from '../src/snapshot.mjs'
const contents = readFileSync(new URL('../public/data/homeric.json', import.meta.url), 'utf8')
const snapshot = validateSnapshot(JSON.parse(contents))
const info = JSON.parse(readFileSync(new URL('../public/data/snapshot-info.json', import.meta.url), 'utf8'))
if (info.sha256 !== createHash('sha256').update(contents).digest('hex')) throw new Error('Snapshot checksum differs; refresh snapshot-info.json after an approved data change')
for (const [key, rows] of Object.entries(snapshot)) if (info.counts[key] !== rows.length) throw new Error('Snapshot count differs: ' + key)
console.log('Public data contract, references, counts and checksum passed:', info.counts)
