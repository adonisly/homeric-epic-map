// SPDX-License-Identifier: AGPL-3.0-only
import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { createSiteContent } from './scripts/site-content.mjs'

const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')
const site = () => createSiteContent(JSON.parse(read('public/data/homeric.json')), process.env.VITE_SITE_URL, process.env.VITE_GOOGLE_SITE_VERIFICATION, JSON.parse(read('public/data/locales/en.json')))
const source = process.env.VITE_SOURCE_URL || 'https://github.com/adonisly/homeric-epic-map/tree/main'
export default defineConfig({
  base: './',
  build: {rollupOptions:{input:{main:resolve(import.meta.dirname,'index.html'),english:resolve(import.meta.dirname,'en/index.html')}}},
  plugins: [{
    name: 'public-site-and-license',
    transformIndexHtml(html, context) {
      const content = site()
      return html.replace('<!--SITE:HEAD-->', context.path.startsWith('/en/') ? content.enHead : content.head).replace('<!--SITE:INTRO-->', context.path.startsWith('/en/') ? content.enIntro : content.intro)
    },
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) if (output.type === 'chunk') output.code = `/*! SPDX-License-Identifier: AGPL-3.0-only\nCorresponding source: ${source}\nThird-party notices: THIRD-PARTY-NOTICES.md */\n` + output.code
      for (const [fileName, value] of Object.entries(site().assets)) this.emitFile({ type: 'asset', fileName, source: value })
      for (const fileName of ['LICENSE', 'NOTICE.md', 'THIRD-PARTY-NOTICES.md']) this.emitFile({ type: 'asset', fileName, source: read(fileName) })
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url || '/', 'http://localhost').pathname
        const file = pathname.endsWith('/explore/') ? pathname.slice(1) + 'index.html' : pathname.slice(1)
        const assets = site().assets
        if (!Object.hasOwn(assets, file)) return next()
        response.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.xml') ? 'application/xml' : 'text/plain')
        response.end(assets[file as keyof typeof assets])
      })
    },
  }],
})
