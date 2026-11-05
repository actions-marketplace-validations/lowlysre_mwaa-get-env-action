import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { logStatus, summaryStatus, toneOf, toOutputs } from '../src/format.ts'

const ESC = '\u001b'

describe('toneOf', () => {
  const cases: Array<[string | undefined, string]> = [
    ['AVAILABLE', 'ok'],
    ['SUCCESS', 'ok'],
    ['UPDATING', 'busy'],
    ['CREATING', 'busy'],
    ['CREATING_SNAPSHOT', 'busy'],
    ['PENDING', 'busy'],
    ['DELETING', 'busy'],
    ['ROLLING_BACK', 'warn'],
    ['MAINTENANCE', 'warn'],
    ['FAILED', 'fail'],
    ['UPDATE_FAILED', 'fail'],
    ['CREATE_FAILED', 'fail'],
    ['UNAVAILABLE', 'fail'],
    ['DELETED', 'fail'],
    [undefined, 'idle'],
    ['', 'idle']
  ]
  for (const [status, tone] of cases) {
    it(`maps ${JSON.stringify(status)} to ${tone}`, () => assert.equal(toneOf(status), tone))
  }
})

describe('logStatus', () => {
  it('colors the dot and status with ANSI', () => {
    assert.equal(logStatus('AVAILABLE'), `${ESC}[32m● AVAILABLE${ESC}[0m`)
    assert.equal(logStatus('UPDATING'), `${ESC}[94m● UPDATING${ESC}[0m`)
    assert.equal(logStatus('MAINTENANCE'), `${ESC}[33m● MAINTENANCE${ESC}[0m`)
    assert.equal(logStatus('UPDATE_FAILED'), `${ESC}[31m● UPDATE_FAILED${ESC}[0m`)
  })

  it('accepts a tone override and a missing or empty status', () => {
    assert.equal(logStatus(undefined), `${ESC}[90m● unknown${ESC}[0m`)
    assert.equal(logStatus(''), `${ESC}[90m● unknown${ESC}[0m`)
    assert.equal(logStatus('AVAILABLE', 'idle'), `${ESC}[90m● AVAILABLE${ESC}[0m`)
  })
})

describe('summaryStatus', () => {
  it('uses colored circle emoji without ANSI codes', () => {
    assert.equal(summaryStatus('AVAILABLE'), '🟢 AVAILABLE')
    assert.equal(summaryStatus('UPDATING'), '🔵 UPDATING')
    assert.equal(summaryStatus('ROLLING_BACK'), '🟡 ROLLING_BACK')
    assert.equal(summaryStatus('FAILED'), '🔴 FAILED')
    assert.equal(summaryStatus(undefined), '⚪')
    assert.equal(summaryStatus(undefined, 'ok'), '🟢')
  })
})

describe('toOutputs', () => {
  it('maps all 15 string outputs, defaulting unset fields to empty strings', () => {
    const o = toOutputs({ Name: 'dev' })
    assert.equal(Object.keys(o).length, 15)
    assert.equal(o.name, 'dev')
    assert.equal(o['last-update-status'], '')
  })
})
