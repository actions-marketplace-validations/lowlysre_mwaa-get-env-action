// Markdown helpers shared by the docs scripts.

// GitHub's heading anchor: lowercase, punctuation dropped except '-' and '_', spaces to '-',
// and a numeric suffix for repeated headings.
export function headings(text) {
  const seen = new Map()
  const result = []
  let inFence = false
  for (const line of text.split('\n')) {
    if (/^(```|~~~)/.test(line)) inFence = !inFence
    if (inFence) continue
    const match = /^(#{1,6}) (.+?)\s*#*\s*$/.exec(line)
    if (!match) continue
    const text = match[2]
    const base = text
      .replace(/`/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-')
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    result.push({ level: match[1].length, text, slug: count ? `${base}-${count}` : base })
  }
  return result
}
