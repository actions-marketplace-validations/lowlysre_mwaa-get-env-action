import { build } from 'esbuild'
import { writeThirdPartyLicenses } from './licenses.mjs'

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.cjs',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  legalComments: 'none',
  logLevel: 'info'
})

const count = writeThirdPartyLicenses('dist/THIRD_PARTY_LICENSES.txt')
console.log(`Wrote dist/THIRD_PARTY_LICENSES.txt (${count} packages)`)
