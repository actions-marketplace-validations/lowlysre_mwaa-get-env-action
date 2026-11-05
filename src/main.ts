import * as core from '@actions/core'
import { GetEnvironmentCommand, MWAAClient, type Environment } from '@aws-sdk/client-mwaa'
import { dim, logStatus, paint, summaryStatus, toneOf, toOutputs, type Outputs } from './format.ts'

const NAME_PATTERN = /^[a-zA-Z][\w-]{0,79}$/

export interface Inputs {
  name: string
  region: string
  summary: boolean
}

type Sender = Pick<MWAAClient, 'send'>

export function readInputs(env: NodeJS.ProcessEnv = process.env): Inputs {
  return {
    name: core.getInput('name', { required: true }).trim(),
    region: (core.getInput('region') || env.AWS_REGION || env.AWS_DEFAULT_REGION || '').trim(),
    summary: core.getBooleanInput('summary')
  }
}

export const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/** Runs the action. Any failure ends the step with a single readable error. */
export async function run(inputs: Inputs, client?: Sender): Promise<void> {
  try {
    validate(inputs)
    core.info(`${paint('1', 'MWAA environment')} ${paint('36', inputs.name)} ${dim(`(${inputs.region})`)}`)
    const environment = await getEnvironment(inputs, client ?? new MWAAClient({ region: inputs.region }))
    const outputs = toOutputs(environment)
    publish(outputs, environment)
    log(inputs.name, outputs, environment)
    if (inputs.summary) await writeSummary(inputs.region, outputs, environment)
  } catch (err) {
    core.setFailed(errorMessage(err))
  }
}

function validate({ name, region }: Inputs): void {
  if (!NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid environment name '${name}': it must start with a letter, contain only letters, digits, '-' or '_', and be at most 80 characters.`
    )
  }
  if (!region) {
    throw new Error("No AWS region: set the 'region' input or AWS_REGION (aws-actions/configure-aws-credentials sets it for you).")
  }
}

async function getEnvironment({ name, region }: Inputs, client: Sender): Promise<Environment> {
  const { Environment } = await client.send(new GetEnvironmentCommand({ Name: name })).catch((err: unknown) => {
    throw new Error(describeFailure(err, name, region), { cause: err })
  })
  if (!Environment) throw new Error("Unexpected response from GetEnvironment: missing 'Environment'.")
  return Environment
}

// Matching on the error name rather than instanceof keeps this working across SDK copies and mocks.
function describeFailure(err: unknown, name: string, region: string): string {
  const code = err instanceof Error ? err.name : 'Error'
  switch (code) {
    case 'ResourceNotFoundException':
      return `MWAA environment '${name}' was not found in region ${region}.`
    case 'AccessDeniedException':
      return `Access denied calling airflow:GetEnvironment for '${name}' in ${region}. Check the IAM permissions of the credentials in use. ${errorMessage(err)}`
    default:
      return `GetEnvironment failed for '${name}' in ${region}: ${code}: ${errorMessage(err)}`
  }
}

function publish(outputs: Outputs, environment: Environment): void {
  for (const [key, value] of Object.entries(outputs)) core.setOutput(key, value)
  core.setOutput('json', JSON.stringify(environment))
}

function log(name: string, outputs: Outputs, environment: Environment): void {
  const label = (text: string) => paint('1', text.padEnd(12))
  core.info(`${label('Status')} ${logStatus(outputs.status)}`)
  core.info(`${label('Last update')} ${logStatus(outputs['last-update-status'])}`)

  core.startGroup('Environment details')
  for (const [key, value] of Object.entries(outputs)) {
    if (key !== 'name' && key !== 'status') core.info(`${dim(key.padEnd(34))} ${value || dim('-')}`)
  }
  core.endGroup()
  core.startGroup('Raw JSON')
  core.info(JSON.stringify(environment, null, 2))
  core.endGroup()

  if (toneOf(outputs.status) === 'fail') {
    core.warning(`MWAA environment '${name}' is ${outputs.status}.`, { title: 'Unhealthy MWAA environment' })
  }
  if (outputs['last-update-status'] === 'FAILED') {
    const error = environment.LastUpdate?.Error
    const detail = error ? `: ${error.ErrorCode}: ${error.ErrorMessage}` : '.'
    core.warning(`The last update of '${name}' failed${detail}`, { title: 'MWAA update failed' })
  }
}

const escapeHtml = (text: string): string => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)

// Joins the non-empty parts, such as an S3 path and its object version, into one code span.
const code = (...parts: string[]): string => {
  const text = parts.filter(Boolean).join(' @ ')
  return text ? `<code>${escapeHtml(text)}</code>` : '–'
}

async function writeSummary(region: string, o: Outputs, environment: Environment): Promise<void> {
  await core.summary
    .addHeading(`MWAA environment: ${escapeHtml(o.name)}`, 2)
    .addRaw(`Region ${code(region)}`, true)
    .addTable([
      [
        { data: 'Property', header: true },
        { data: 'Value', header: true }
      ],
      ['Status', escapeHtml(summaryStatus(o.status))],
      ['Last update', escapeHtml(summaryStatus(o['last-update-status']))],
      ['Airflow version', code(o['airflow-version'])],
      ['Environment class', code(o['environment-class'])],
      ['Webserver URL', code(o['webserver-url'])],
      ['ARN', code(o['environment-arn'])],
      ['Source bucket', code(o['source-bucket-arn'])],
      ['DAGs path', code(o['dag-s3-path'])],
      ['requirements.txt', code(o['requirements-s3-path'], o['requirements-s3-object-version'])],
      ['plugins.zip', code(o['plugins-s3-path'], o['plugins-s3-object-version'])],
      ['Startup script', code(o['startup-script-s3-path'], o['startup-script-s3-object-version'])]
    ])
    .addDetails('Raw JSON', `<pre>${escapeHtml(JSON.stringify(environment, null, 2))}</pre>`)
    .write()
}
