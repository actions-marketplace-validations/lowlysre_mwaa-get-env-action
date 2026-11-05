// Regenerates the table of contents between <!-- toc --> and <!-- tocstop --> in each docs page.
// markdownlint (MD051) and lychee catch any ToC link this leaves pointing at a missing heading.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const TOC = /(<!-- toc -->)[\s\S]*?(<!-- tocstop -->)/

// GitHub's heading anchor: lowercase, punctuation dropped except '-' and '_', spaces to '-'.
const slug = heading =>
  heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')

for (const file of readdirSync('docs').filter(f => f.endsWith('.md'))) {
  const path = `docs/${file}`
  const text = readFileSync(path, 'utf8')
  const prose = text.replace(/^```[\s\S]*?^```/gm, '')
  const list = [...prose.matchAll(/^## (.+?)\r?$/gm)].map(([, heading]) => `- [${heading}](#${slug(heading)})`).join('\n')
  writeFileSync(path, text.replace(TOC, `$1\n\n${list}\n\n$2`))
}
