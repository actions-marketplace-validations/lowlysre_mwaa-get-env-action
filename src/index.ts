import * as core from '@actions/core'
import { readInputs, run } from './main.ts'

run(readInputs()).catch((err: unknown) => core.setFailed(err instanceof Error ? err.message : String(err)))
