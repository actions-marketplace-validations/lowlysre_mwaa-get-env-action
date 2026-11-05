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
    arn: s(env.Arn),
    airflow_version: s(env.AirflowVersion),
    environment_class: s(env.EnvironmentClass),
    webserver_url: s(env.WebserverUrl),
    source_bucket_arn: s(env.SourceBucketArn),
    dag_s3_path: s(env.DagS3Path),
    requirements_s3_path: s(env.RequirementsS3Path),
    requirements_s3_object_version: s(env.RequirementsS3ObjectVersion),
    plugins_s3_path: s(env.PluginsS3Path),
    plugins_s3_object_version: s(env.PluginsS3ObjectVersion),
    startup_script_s3_path: s(env.StartupScriptS3Path),
    startup_script_s3_object_version: s(env.StartupScriptS3ObjectVersion),
    last_update_status: s(env.LastUpdate?.Status)
  }
}
