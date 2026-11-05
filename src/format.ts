import type { Environment } from '@aws-sdk/client-mwaa'

export type Health = 'ok' | 'transitioning' | 'failed'

const FAILED = new Set(['CREATE_FAILED', 'UPDATE_FAILED', 'UNAVAILABLE', 'DELETED'])

export function classify(status: string | undefined): Health {
  if (status === 'AVAILABLE') return 'ok'
  if (status && FAILED.has(status)) return 'failed'
  return 'transitioning'
}

const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m'
}

export const paint = {
  bold: (s: string) => `${ANSI.bold}${s}${ANSI.reset}`,
  dim: (s: string) => `${ANSI.dim}${s}${ANSI.reset}`,
  cyan: (s: string) => `${ANSI.cyan}${s}${ANSI.reset}`,
  health: (h: Health, s: string) => {
    const c = h === 'ok' ? ANSI.green : h === 'failed' ? ANSI.red : ANSI.yellow
    return `${c}${s}${ANSI.reset}`
  }
}

export const icon = (h: Health) => (h === 'ok' ? '✅' : h === 'failed' ? '❌' : '⏳')

/** Output name -> value. Fields the environment does not set become empty strings. */
export function toOutputs(env: Environment): Record<string, string> {
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
