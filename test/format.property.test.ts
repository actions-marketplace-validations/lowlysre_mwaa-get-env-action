import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fc from 'fast-check'
import { logStatus, summaryStatus, toneOf, toOutputs } from '../src/format.ts'

const TONES = new Set(['ok', 'busy', 'warn', 'fail', 'idle'])
const ANSI = /\u001b\[[0-9;]*m/g

describe('format properties', () => {
  it('maps any status string to a known tone', () => {
    fc.assert(fc.property(fc.option(fc.string(), { nil: undefined }), status => TONES.has(toneOf(status))))
  })

  it('keeps the status text intact in the log and the summary', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), status => {
        assert.equal(logStatus(status).replace(ANSI, ''), `● ${status}`)
        assert.ok(summaryStatus(status).endsWith(` ${status}`.trimEnd()))
        assert.doesNotMatch(summaryStatus(status), /\u001b\[/)
      })
    )
  })

  it('returns a string for every output, whatever fields the environment has', () => {
    const env = fc.record(
      {
        Name: fc.string(),
        Status: fc.string(),
        Arn: fc.string(),
        AirflowVersion: fc.string(),
        EnvironmentClass: fc.string(),
        WebserverUrl: fc.string(),
        SourceBucketArn: fc.string(),
        DagS3Path: fc.string(),
        RequirementsS3Path: fc.string(),
        RequirementsS3ObjectVersion: fc.string(),
        PluginsS3Path: fc.string(),
        PluginsS3ObjectVersion: fc.string(),
        StartupScriptS3Path: fc.string(),
        StartupScriptS3ObjectVersion: fc.string(),
        LastUpdate: fc.record({ Status: fc.string() }, { requiredKeys: [] })
      },
      { requiredKeys: [] }
    )
    fc.assert(
      fc.property(env, e => {
        const outputs = toOutputs(e as Parameters<typeof toOutputs>[0])
        assert.equal(Object.keys(outputs).length, 15)
        for (const value of Object.values(outputs)) assert.equal(typeof value, 'string')
      })
    )
  })
})
