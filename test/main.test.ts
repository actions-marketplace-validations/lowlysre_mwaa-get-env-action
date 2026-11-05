import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { GetEnvironmentCommand, MWAAClient, ResourceNotFoundException } from '@aws-sdk/client-mwaa'
import { mockClient, type AwsClientStub } from 'aws-sdk-client-mock'
import { classify, toOutputs } from '../src/format.ts'
import { readInputs, run, type Inputs } from '../src/main.ts'

const full = {
  Name: 'prod',
  Status: 'AVAILABLE' as const,
  Arn: 'arn:aws:airflow:us-west-2:123456789012:environment/prod',
  CreatedAt: new Date('2026-01-01T00:00:00Z'),
  WebserverUrl: 'a1b2c3d4.c10.us-west-2.airflow.amazonaws.com',
  AirflowVersion: '2.10.3',
  SourceBucketArn: 'arn:aws:s3:::my-airflow-bucket',
  DagS3Path: 'dags',
  PluginsS3Path: 'plugins.zip',
  PluginsS3ObjectVersion: '3sL4kqtJlcpXroDTDmJ+rmSpXd3dIbrHY+MTRCxf3vjVBH40Nr8X8gdRQBpUMLUo',
  RequirementsS3Path: 'requirements.txt',
  RequirementsS3ObjectVersion: 'reqv1.AbCdEf',
  StartupScriptS3Path: 'startup.sh',
  StartupScriptS3ObjectVersion: 'startv1.GhIjKl',
  EnvironmentClass: 'mw1.small',
  NetworkConfiguration: { SubnetIds: ['subnet-1', 'subnet-2'] },
  LastUpdate: { Status: 'SUCCESS' as const }
}

let dir: string
let outFile: string
let summaryFile: string
let stdout: string

const realWrite = process.stdout.write.bind(process.stdout) as (...a: unknown[]) => boolean
// The test runner streams binary events over stdout, so only text from the action is captured.
const captureStdout = () =>
  mock.method(process.stdout, 'write', ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    if (typeof chunk === 'string') {
      stdout += chunk
      return true
    }
    return realWrite(chunk, ...rest)
  }) as typeof process.stdout.write)

/** Parses the GITHUB_OUTPUT file, including the heredoc form used for values with special characters. */
function readOutputs(): Record<string, string> {
  const result: Record<string, string> = {}
  const lines = readFileSync(outFile, 'utf8').split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const heredoc = /^([^=<]+)<<(.+)$/.exec(line)
    if (heredoc) {
      const end = lines.indexOf(heredoc[2] as string, i + 1)
      result[heredoc[1] as string] = lines.slice(i + 1, end).join('\n')
      i = end
    } else if (line.includes('=')) {
      const at = line.indexOf('=')
      result[line.slice(0, at)] = line.slice(at + 1)
    }
  }
  return result
}

function assertSubset(actual: Record<string, string>, expected: Record<string, string>): void {
  for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, `output ${key}`)
}

const inputs = (over: Partial<Inputs> = {}): Inputs => ({ name: 'prod', region: 'us-west-2', summary: false, ...over })
const sdkClient = () => new MWAAClient({ region: 'us-west-2' })

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mwaa-'))
  outFile = join(dir, 'output')
  summaryFile = join(dir, 'summary.md')
  writeFileSync(outFile, '')
  writeFileSync(summaryFile, '')
  process.env.GITHUB_OUTPUT = outFile
  process.env.GITHUB_STEP_SUMMARY = summaryFile
  process.exitCode = undefined
  stdout = ''
  captureStdout()
})

afterEach(() => {
  mock.restoreAll()
  process.exitCode = undefined
  rmSync(dir, { recursive: true, force: true })
})

describe('run with a mocked SDK', () => {
  let sdk: AwsClientStub<MWAAClient>
  beforeEach(() => {
    sdk = mockClient(MWAAClient)
  })
  afterEach(() => sdk.restore())

  it('publishes every output for a fully populated environment', async () => {
    sdk.on(GetEnvironmentCommand, { Name: 'prod' }).resolves({ Environment: full })
    await run(inputs(), sdkClient())
    const o = readOutputs()
    assert.equal(process.exitCode, undefined)
    assertSubset(o, {
      name: 'prod',
      status: 'AVAILABLE',
      arn: full.Arn,
      airflow_version: '2.10.3',
      environment_class: 'mw1.small',
      webserver_url: full.WebserverUrl,
      source_bucket_arn: full.SourceBucketArn,
      dag_s3_path: 'dags',
      requirements_s3_path: 'requirements.txt',
      requirements_s3_object_version: 'reqv1.AbCdEf',
      plugins_s3_path: 'plugins.zip',
      plugins_s3_object_version: full.PluginsS3ObjectVersion,
      startup_script_s3_path: 'startup.sh',
      startup_script_s3_object_version: 'startv1.GhIjKl',
      last_update_status: 'SUCCESS'
    })
    const json = JSON.parse(o.json as string)
    assert.equal(json.Name, 'prod')
    assert.equal(json.NetworkConfiguration.SubnetIds.length, 2)
    assert.equal(json.CreatedAt, '2026-01-01T00:00:00.000Z')
  })

  it('returns empty strings for fields the environment does not set', async () => {
    sdk.on(GetEnvironmentCommand).resolves({ Environment: { Name: 'dev', Status: 'CREATING' } })
    await run(inputs({ name: 'dev' }), sdkClient())
    assertSubset(readOutputs(), { status: 'CREATING', plugins_s3_object_version: '', startup_script_s3_path: '', last_update_status: '' })
    assert.equal(process.exitCode, undefined)
  })

  it('fails clearly when the environment does not exist', async () => {
    sdk.on(GetEnvironmentCommand).rejects(new ResourceNotFoundException({ message: 'Environment ghost not found', $metadata: {} }))
    await run(inputs({ name: 'ghost' }), sdkClient())
    assert.equal(process.exitCode, 1)
    assert.match(stdout, /::error::MWAA environment 'ghost' was not found in region us-west-2\./)
    assert.equal(readFileSync(outFile, 'utf8'), '')
  })

  it('explains access denied errors', async () => {
    sdk.on(GetEnvironmentCommand).rejects(Object.assign(new Error('not authorized'), { name: 'AccessDeniedException' }))
    await run(inputs(), sdkClient())
    assert.equal(process.exitCode, 1)
    assert.match(stdout, /Access denied calling airflow:GetEnvironment/)
  })

  it('surfaces other errors with their name', async () => {
    sdk.on(GetEnvironmentCommand).rejects(Object.assign(new Error('boom'), { name: 'ThrottlingException' }))
    await run(inputs(), sdkClient())
    assert.equal(process.exitCode, 1)
    assert.match(stdout, /ThrottlingException: boom/)
  })

  it('fails when the response has no Environment', async () => {
    sdk.on(GetEnvironmentCommand).resolves({})
    await run(inputs(), sdkClient())
    assert.equal(process.exitCode, 1)
    assert.match(stdout, /missing 'Environment'/)
  })

  for (const name of ['', '1abc', 'has space', 'a'.repeat(81)]) {
    it(`rejects invalid name ${JSON.stringify(name.slice(0, 12))} before calling AWS`, async () => {
      await run(inputs({ name }), sdkClient())
      assert.equal(process.exitCode, 1)
      assert.match(stdout, /Invalid environment name/)
      assert.equal(sdk.calls().length, 0)
    })
  }

  it('fails when no region can be determined', async () => {
    await run(inputs({ region: '' }), sdkClient())
    assert.equal(process.exitCode, 1)
    assert.match(stdout, /No AWS region/)
  })

  it('annotates unhealthy environments and failed updates without failing the step', async () => {
    sdk.on(GetEnvironmentCommand).resolves({
      Environment: { ...full, Status: 'UPDATE_FAILED', LastUpdate: { Status: 'FAILED', Error: { ErrorCode: '5000', ErrorMessage: 'bad requirements' } } }
    })
    await run(inputs(), sdkClient())
    assert.equal(process.exitCode, undefined)
    assert.match(stdout, /::warning title=Unhealthy MWAA environment::MWAA environment 'prod' is UPDATE_FAILED\./)
    assert.match(stdout, /bad requirements/)
  })

  it('writes a job summary when enabled and skips it when disabled', async () => {
    sdk.on(GetEnvironmentCommand).resolves({ Environment: full })
    await run(inputs({ summary: true }), sdkClient())
    const md = readFileSync(summaryFile, 'utf8')
    assert.match(md, /MWAA environment prod/)
    assert.match(md, /2\.10\.3/)
    assert.match(md, /reqv1\.AbCdEf/)

    writeFileSync(summaryFile, '')
    await run(inputs({ summary: false }), sdkClient())
    assert.equal(readFileSync(summaryFile, 'utf8'), '')
  })

  it('groups verbose output so the log stays readable', async () => {
    sdk.on(GetEnvironmentCommand).resolves({ Environment: full })
    await run(inputs(), sdkClient())
    assert.match(stdout, /::group::Environment details/)
    assert.match(stdout, /::group::Raw JSON/)
    assert.equal(stdout.match(/::endgroup::/g)?.length, 2)
  })
})

describe('run with the real SDK against a local HTTP server', () => {
  let server: Server
  let client: MWAAClient

  beforeEach(async () => {
    server = createServer((req, res) => {
      const name = decodeURIComponent((req.url ?? '').split('/').pop() ?? '')
      if (name === 'prod') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ Environment: { ...full, CreatedAt: 1767225600 } }))
      } else if (name.startsWith('deny')) {
        res.writeHead(403, { 'content-type': 'application/json', 'x-amzn-errortype': 'AccessDeniedException' })
        res.end(JSON.stringify({ message: 'not authorized' }))
      } else {
        res.writeHead(404, { 'content-type': 'application/json', 'x-amzn-errortype': 'ResourceNotFoundException' })
        res.end(JSON.stringify({ message: `Environment ${name} not found` }))
      }
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as { port: number }
    client = new MWAAClient({
      region: 'us-west-2',
      endpoint: `http://127.0.0.1:${port}`,
      credentials: { accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'x' },
      disableHostPrefix: true,
      maxAttempts: 1
    })
  })

  afterEach(() => new Promise<void>(resolve => server.close(() => resolve())))

  it('maps a real 200 response to outputs', async () => {
    await run(inputs(), client)
    assert.equal(process.exitCode, undefined)
    assertSubset(readOutputs(), { status: 'AVAILABLE', airflow_version: '2.10.3', plugins_s3_object_version: full.PluginsS3ObjectVersion })
  })

  it('maps a real 404 ResourceNotFoundException to the not-found failure', async () => {
    await run(inputs({ name: 'ghost' }), client)
    assert.equal(process.exitCode, 1)
    assert.match(stdout, /MWAA environment 'ghost' was not found/)
  })

  it('maps a real 403 AccessDeniedException', async () => {
    await run(inputs({ name: 'deny-me' }), client)
    assert.equal(process.exitCode, 1)
    assert.match(stdout, /Access denied/)
  })
})

describe('readInputs', () => {
  afterEach(() => {
    for (const k of ['NAME', 'REGION', 'SUMMARY']) delete process.env[`INPUT_${k}`]
  })

  it('prefers the region input, then AWS_REGION, then AWS_DEFAULT_REGION', () => {
    process.env.INPUT_NAME = 'prod'
    process.env.INPUT_SUMMARY = 'true'
    process.env.INPUT_REGION = 'eu-west-1'
    assert.equal(readInputs({ AWS_REGION: 'us-east-1' }).region, 'eu-west-1')
    process.env.INPUT_REGION = ''
    assert.equal(readInputs({ AWS_REGION: 'us-east-1', AWS_DEFAULT_REGION: 'us-west-1' }).region, 'us-east-1')
    assert.equal(readInputs({ AWS_DEFAULT_REGION: 'us-west-1' }).region, 'us-west-1')
    assert.equal(readInputs({}).region, '')
  })
})

describe('format', () => {
  it('classifies statuses', () => {
    assert.equal(classify('AVAILABLE'), 'ok')
    assert.equal(classify('UPDATE_FAILED'), 'failed')
    assert.equal(classify('CREATE_FAILED'), 'failed')
    assert.equal(classify('UPDATING'), 'transitioning')
    assert.equal(classify(undefined), 'transitioning')
  })

  it('maps all 15 string outputs', () => {
    assert.equal(Object.keys(toOutputs(full)).length, 15)
  })
})
