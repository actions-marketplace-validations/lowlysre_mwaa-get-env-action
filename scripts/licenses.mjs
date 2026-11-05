import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const LICENSE_FILE = /^(licen[sc]e|copying)(\.(md|txt))?$/i
const NOTICE_FILE = /^notice(\.(md|txt))?$/i

function productionPackageDirs() {
  // npm sets npm_execpath to its CLI script; running it with node avoids a shell on Windows.
  const npmCli = process.env.npm_execpath
  if (!npmCli) {
    throw new Error('Run the build through npm (npm run build) so npm_execpath is set.')
  }
  const output = execFileSync(process.execPath, [npmCli, 'ls', '--omit=dev', '--all', '--parseable'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  })
  const root = process.cwd()
  return output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(dir => dir && path.resolve(dir) !== root)
}

function readMatching(dir, pattern) {
  const file = readdirSync(dir).find(name => pattern.test(name))
  return file ? readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n').trim() : undefined
}

function describe(dir) {
  const manifest = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'))
  return {
    name: manifest.name,
    version: manifest.version,
    license: manifest.license ?? 'UNKNOWN',
    text: readMatching(dir, LICENSE_FILE),
    notice: readMatching(dir, NOTICE_FILE)
  }
}

/** Writes the license and NOTICE text of every production dependency, in a stable order, so dist/ stays reproducible. */
export function writeThirdPartyLicenses(outFile) {
  const seen = new Map()
  for (const dir of productionPackageDirs()) {
    if (!existsSync(path.join(dir, 'package.json'))) {
      continue
    }
    const info = describe(dir)
    seen.set(`${info.name}@${info.version}`, info)
  }

  const byLicense = new Map()
  for (const info of seen.values()) {
    if (info.text && !byLicense.has(info.license)) {
      byLicense.set(info.license, info.text)
    }
  }

  const sections = [...seen.keys()].toSorted().map(key => {
    const { name, version, license, text, notice } = seen.get(key)
    const shared = byLicense.get(license)
    const body =
      text ??
      (shared
        ? `The package ships no license file. Full ${license} text, as shipped by other bundled packages under the same license:\n\n${shared}`
        : `License: ${license} (no license file shipped in the package)`)
    const noticeBlock = notice ? `\n\nNOTICE:\n\n${notice}` : ''
    return `${name}@${version}\nLicense: ${license}\n\n${body}${noticeBlock}`
  })

  const header = 'Third-party software bundled into dist/index.cjs\n'
  writeFileSync(outFile, `${header}\n${sections.join(`\n\n${'-'.repeat(72)}\n\n`)}\n`)
  return seen.size
}
