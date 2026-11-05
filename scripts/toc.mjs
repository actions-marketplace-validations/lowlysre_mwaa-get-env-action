// Regenerates the table of contents between <!-- toc --> and <!-- tocstop --> in each docs page.
// Usage: node scripts/toc.mjs [--check]. With --check it writes nothing and fails on a stale ToC.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { headings } from './markdown.mjs'

const START = '<!-- toc -->'
const STOP = '<!-- tocstop -->'
const check = process.argv.includes('--check')
const files = readdirSync('docs')
  .filter(f => f.endsWith('.md'))
  .map(f => `docs/${f}`)

let stale = 0
for (const file of files) {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  const start = text.indexOf(START)
  const stop = text.indexOf(STOP)
  if (start === -1 || stop < start) {
    console.error(`${file}: missing ${START} ... ${STOP} markers`)
    stale++
    continue
  }
  const list = headings(text)
    .filter(h => h.level === 2)
    .map(h => `- [${h.text}](#${h.slug})`)
    .join('\n')
  const updated = `${text.slice(0, start + START.length)}\n\n${list}\n\n${text.slice(stop)}`
  if (updated === text) continue
  if (check) {
    console.error(`${file}: table of contents is out of date. Run npm run docs:toc.`)
    stale++
  } else {
    writeFileSync(file, updated)
    console.log(`${file}: table of contents updated`)
  }
}
process.exit(stale ? 1 : 0)
