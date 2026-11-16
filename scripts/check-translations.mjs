// SPDX-License-Identifier: AGPL-3.0-only
import {readFileSync} from 'node:fs'
import {translationReport} from '../src/i18n/content.mjs'
const graph=JSON.parse(readFileSync(new URL('../public/data/homeric.json',import.meta.url),'utf8'))
const translations=JSON.parse(readFileSync(new URL('../public/data/locales/en.json',import.meta.url),'utf8'))
const report=translationReport(graph,translations)
console.log('English translation coverage:',report)
if(report.missing||report.stale){console.error('Update missing or stale translations before publishing; source matching is not editorial verification.');process.exitCode=1}
