// Checks README.md and docs/: every relative link and #anchor resolves, and every example
// using this action only passes inputs and reads outputs that action.yml declares.
// Usage: node scripts/check-docs.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { headings } from './markdown.mjs'

const read = file => readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const SELF = 'lowlysre/mwaa-get-env-action'

function actionKeys(section) {
  const match = new RegExp(`^${section}:\\n((?:  .*\\n|\\n)+?)(?=^\\S|$(?![\\s\\S]))`, 'm').exec(read('action.yml'))
  return new Set([...(match?.[1] ?? '').matchAll(/^ {2}([a-z0-9-]+):/gm)].map(m => m[1]))
}
const inputs = actionKeys('inputs')
const outputs = actionKeys('outputs')

const files = [
  'README.md',
  ...readdirSync('docs')
    .filter(f => f.endsWith('.md'))
    .map(f => `docs/${f}`)
]
const problems = []
const counts = { links: 0, anchors: 0, inputs: 0, outputs: 0 }

for (const file of files) {
  const text = read(file)
  const dir = path.dirname(file)

  for (const [, target, anchor] of text.matchAll(/\]\(([^)#\s]*)(#[^)\s]*)?\)/g)) {
    if (/^[a-z]+:/i.test(target)) continue
    const resolved = target ? path.join(dir, target) : file
    if (target) {
      counts.links++
      if (!existsSync(resolved)) {
        problems.push(`${file}: broken link ${target}`)
        continue
      }
    }
    if (anchor && resolved.endsWith('.md')) {
      counts.anchors++
      if (!headings(read(resolved)).some(h => `#${h.slug}` === anchor)) problems.push(`${file}: broken anchor ${target}${anchor}`)
    }
  }

  for (const [, yaml] of text.matchAll(/```yaml\n([\s\S]*?)```/g)) {
    const ownSteps = new Set()
    for (const step of yaml.split(/\n(?=\s*- )/)) {
      if (!step.includes(`uses: ${SELF}@`)) continue
      const id = /\bid: (\S+)/.exec(step)
      if (id) ownSteps.add(id[1])
      const withBlock = /with:\n((?:\s{4,}.*\n?)+)/.exec(step)
      for (const [, key] of (withBlock?.[1] ?? '').matchAll(/^\s+([a-z0-9-]+):/gm)) {
        counts.inputs++
        if (!inputs.has(key)) problems.push(`${file}: unknown input '${key}'`)
      }
    }
    for (const [, id, key] of yaml.matchAll(/steps\.(\w+)\.outputs\.([a-z0-9-]+)/g)) {
      if (!ownSteps.has(id)) continue
      counts.outputs++
      if (!outputs.has(key)) problems.push(`${file}: unknown output '${key}' on step '${id}'`)
    }
  }
}

for (const problem of problems) console.error(problem)
console.log(`Checked ${counts.links} links, ${counts.anchors} anchors, ${counts.inputs} inputs, ${counts.outputs} outputs.`)
process.exit(problems.length ? 1 : 0)
