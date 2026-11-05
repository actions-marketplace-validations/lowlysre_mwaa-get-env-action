import * as core from '@actions/core'
import { GetEnvironmentCommand, MWAAClient, type Environment } from '@aws-sdk/client-mwaa'
import { dim, logStatus, paint, summaryStatus, toneOf, toOutputs } from './format.ts'

const NAME_PATTERN = /^[a-zA-Z][0-9a-zA-Z-_]{0,79}$/

export interface Inputs {
  name: string
  region: string
  summary: boolean
}

export function readInputs(env: NodeJS.ProcessEnv = process.env): Inputs {
  return {
    name: core.getInput('name', { required: true }).trim(),
    region: (core.getInput('region') || env.AWS_REGION || env.AWS_DEFAULT_REGION || '').trim(),
    summary: core.getBooleanInput('summary')
  }
}

const errName = (err: unknown) => (err as { name?: string } | null)?.name ?? 'Error'
const errMessage = (err: unknown) => (err as { message?: string } | null)?.message ?? String(err)

export async function run(inputs: Inputs, client?: Pick<MWAAClient, 'send'>): Promise<void> {
  const { name, region } = inputs

  if (!NAME_PATTERN.test(name)) {
    core.setFailed(
      `Invalid environment name '${name}': it must start with a letter, contain only letters, digits, '-' or '_', and be at most 80 characters.`
    )
    return
  }
  if (!region) {
    core.setFailed("No AWS region: set the 'region' input or AWS_REGION (aws-actions/configure-aws-credentials sets it for you).")
    return
  }

  core.info(`${paint('1', 'MWAA environment')} ${paint('36', name)} ${dim(`(${region})`)}`)
  const mwaa = client ?? new MWAAClient({ region })

  let environment: Environment | undefined
  try {
    ;({ Environment: environment } = await mwaa.send(new GetEnvironmentCommand({ Name: name })))
  } catch (err) {
    // Matching on name keeps this working when the error crosses SDK copies or is rebuilt by a mock.
    switch (errName(err)) {
      case 'ResourceNotFoundException':
        core.setFailed(`MWAA environment '${name}' was not found in region ${region}.`)
        break
      case 'AccessDeniedException':
        core.setFailed(
          `Access denied calling airflow:GetEnvironment for '${name}' in ${region}. Check the IAM permissions of the credentials in use. ${errMessage(err)}`
        )
        break
      default:
        core.setFailed(`GetEnvironment failed for '${name}' in ${region}: ${errName(err)}: ${errMessage(err)}`)
    }
    return
  }
  if (!environment) {
    core.setFailed("Unexpected response from GetEnvironment: missing 'Environment'.")
    return
  }

  const outputs = toOutputs(environment)
  for (const [key, value] of Object.entries(outputs)) core.setOutput(key, value)
  const json = JSON.stringify(environment)
  core.setOutput('json', json)

  const status = outputs.status || 'UNKNOWN'
  core.info(`${paint('1', 'Status')}       ${logStatus(environment.Status)}`)
  core.info(`${paint('1', 'Last update')}  ${logStatus(environment.LastUpdate?.Status)}`)

  core.startGroup('Environment details')
  for (const [key, value] of Object.entries(outputs)) {
    if (key !== 'name' && key !== 'status') core.info(`${dim(key.padEnd(34))} ${value || dim('-')}`)
  }
  core.endGroup()
  core.startGroup('Raw JSON')
  core.info(JSON.stringify(environment, null, 2))
  core.endGroup()

  if (toneOf(environment.Status) === 'fail')
    core.warning(`MWAA environment '${name}' is ${status}.`, { title: 'Unhealthy MWAA environment' })
  if (outputs['last-update-status'] === 'FAILED') {
    const e = environment.LastUpdate?.Error
    core.warning(`The last update of '${name}' failed${e ? `: ${e.ErrorCode}: ${e.ErrorMessage}` : '.'}`, { title: 'MWAA update failed' })
  }

  if (inputs.summary) await writeSummary(name, region, outputs, environment)
}

async function writeSummary(name: string, region: string, o: Record<string, string>, environment: Environment): Promise<void> {
  const code = (v: string) => (v ? `<code>${v}</code>` : '–')
  const withVersion = (path: string, version: string) => [path, version].filter(Boolean).join(' @ ')
  await core.summary
    .addHeading(`MWAA environment: ${name}`, 2)
    .addRaw(`Region <code>${region}</code>`, true)
    .addTable([
      [
        { data: 'Property', header: true },
        { data: 'Value', header: true }
      ],
      ['Status', summaryStatus(environment.Status)],
      ['Last update', summaryStatus(environment.LastUpdate?.Status)],
      ['Airflow version', code(o['airflow-version'] ?? '')],
      ['Environment class', code(o['environment-class'] ?? '')],
      ['Webserver URL', code(o['webserver-url'] ?? '')],
      ['ARN', code(o['environment-arn'] ?? '')],
      ['Source bucket', code(o['source-bucket-arn'] ?? '')],
      ['DAGs path', code(o['dag-s3-path'] ?? '')],
      ['requirements.txt', code(withVersion(o['requirements-s3-path'] ?? '', o['requirements-s3-object-version'] ?? ''))],
      ['plugins.zip', code(withVersion(o['plugins-s3-path'] ?? '', o['plugins-s3-object-version'] ?? ''))],
      ['Startup script', code(withVersion(o['startup-script-s3-path'] ?? '', o['startup-script-s3-object-version'] ?? ''))]
    ])
    .addDetails('Raw JSON', `<pre>${JSON.stringify(environment, null, 2).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`)
    .write()
}
