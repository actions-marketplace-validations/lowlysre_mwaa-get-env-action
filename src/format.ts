import type { Environment } from '@aws-sdk/client-mwaa'

export type Tone = 'ok' | 'busy' | 'warn' | 'fail' | 'idle'

const ANSI: Record<Tone, string> = { ok: '32', busy: '94', warn: '33', fail: '31', idle: '90' }
const SUMMARY_DOT: Record<Tone, string> = { ok: '🟢', busy: '🔵', warn: '🟡', fail: '🔴', idle: '⚪' }

export const paint = (code: string, text: string): string => `\u001b[${code}m${text}\u001b[0m`
export const dim = (text: string): string => paint('2', text)

// Covers both Environment.Status and LastUpdate.Status values.
export function toneOf(status: string | undefined): Tone {
  switch (status) {
    case 'AVAILABLE':
    case 'SUCCESS':
      return 'ok'
    case 'ROLLING_BACK':
    case 'MAINTENANCE':
      return 'warn'
    case 'FAILED':
    case 'UPDATE_FAILED':
    case 'CREATE_FAILED':
    case 'UNAVAILABLE':
    case 'DELETED':
      return 'fail'
    case undefined:
    case '':
      return 'idle'
    default:
      return 'busy'
  }
}

// A colored "● STATUS" for the step log.
export function logStatus(status: string | undefined, tone: Tone = toneOf(status)): string {
  return paint(ANSI[tone], `● ${status || 'unknown'}`)
}

// A "🟢 STATUS" for the job summary, which renders markdown and ignores ANSI codes.
export function summaryStatus(status: string | undefined, tone: Tone = toneOf(status)): string {
  return `${SUMMARY_DOT[tone]} ${status ?? ''}`.trimEnd()
}

export type Outputs = ReturnType<typeof toOutputs>

/** Output name -> value. Fields the environment does not set become empty strings. */
export function toOutputs(env: Environment) {
  const s = (v: string | undefined) => v ?? ''
  return {
    name: s(env.Name),
    status: s(env.Status),
    'environment-arn': s(env.Arn),
    'airflow-version': s(env.AirflowVersion),
    'environment-class': s(env.EnvironmentClass),
    'webserver-url': s(env.WebserverUrl),
    'source-bucket-arn': s(env.SourceBucketArn),
    'dag-s3-path': s(env.DagS3Path),
    'requirements-s3-path': s(env.RequirementsS3Path),
    'requirements-s3-object-version': s(env.RequirementsS3ObjectVersion),
    'plugins-s3-path': s(env.PluginsS3Path),
    'plugins-s3-object-version': s(env.PluginsS3ObjectVersion),
    'startup-script-s3-path': s(env.StartupScriptS3Path),
    'startup-script-s3-object-version': s(env.StartupScriptS3ObjectVersion),
    'last-update-status': s(env.LastUpdate?.Status)
  }
}
