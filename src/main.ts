import * as core from '@actions/core'
import { GetEnvironmentCommand, MWAAClient, type Environment } from '@aws-sdk/client-mwaa'
import { classify, icon, paint, toOutputs, type Health } from './format.ts'

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
    core.setFailed(`Invalid environment name '${name}': it must start with a letter, contain only letters, digits, '-' or '_', and be at most 80 characters.`)
    return
  }
  if (!region) {
    core.setFailed("No AWS region: set the 'region' input or AWS_REGION (aws-actions/configure-aws-credentials sets it for you).")
    return
  }

  core.info(`${paint.bold('MWAA environment')} ${paint.cyan(name)} ${paint.dim(`(${region})`)}`)
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
        core.setFailed(`Access denied calling airflow:GetEnvironment for '${name}' in ${region}. Check the IAM permissions of the credentials in use. ${errMessage(err)}`)
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

  const health = classify(environment.Status)
  const status = outputs.status || 'UNKNOWN'
  core.info(`${paint.bold('Status')}  ${paint.health(health, status)}`)

  core.startGroup('Environment details')
  for (const [key, value] of Object.entries(outputs)) {
    if (key !== 'name' && key !== 'status') core.info(`${paint.dim(key.padEnd(34))} ${value || paint.dim('-')}`)
  }
  core.endGroup()
  core.startGroup('Raw JSON')
  core.info(JSON.stringify(environment, null, 2))
  core.endGroup()

  if (health === 'failed') core.warning(`MWAA environment '${name}' is ${status}.`, { title: 'Unhealthy MWAA environment' })
  if (outputs.last_update_status === 'FAILED') {
    const e = environment.LastUpdate?.Error
    core.warning(`The last update of '${name}' failed${e ? `: ${e.ErrorCode}: ${e.ErrorMessage}` : '.'}`, { title: 'MWAA update failed' })
  }

  if (inputs.summary) await writeSummary(name, region, health, outputs, environment)
}

async function writeSummary(name: string, region: string, health: Health, o: Record<string, string>, environment: Environment): Promise<void> {
  const code = (v: string) => (v ? `<code>${v}</code>` : '–')
  const withVersion = (path: string, version: string) => [path, version].filter(Boolean).join(' @ ')
  await core.summary
    .addHeading(`${icon(health)} MWAA environment ${name}`, 2)
    .addRaw(`Region <code>${region}</code> · status <b>${o.status || 'UNKNOWN'}</b> · last update <b>${o.last_update_status || 'n/a'}</b>`, true)
    .addTable([
      [{ data: 'Property', header: true }, { data: 'Value', header: true }],
      ['Airflow version', code(o.airflow_version ?? '')],
      ['Environment class', code(o.environment_class ?? '')],
      ['Webserver URL', code(o.webserver_url ?? '')],
      ['ARN', code(o.arn ?? '')],
      ['Source bucket', code(o.source_bucket_arn ?? '')],
      ['DAGs path', code(o.dag_s3_path ?? '')],
      ['requirements.txt', code(withVersion(o.requirements_s3_path ?? '', o.requirements_s3_object_version ?? ''))],
      ['plugins.zip', code(withVersion(o.plugins_s3_path ?? '', o.plugins_s3_object_version ?? ''))],
      ['Startup script', code(withVersion(o.startup_script_s3_path ?? '', o.startup_script_s3_object_version ?? ''))]
    ])
    .addDetails('Raw JSON', `<pre>${JSON.stringify(environment, null, 2).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`)
    .write()
}
