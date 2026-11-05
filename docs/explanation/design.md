# Why an action instead of the AWS CLI

`aws mwaa get-environment` works in a workflow, and this action is a thin, typed wrapper around the same `GetEnvironment` API. The wrapper exists for the parts that are tedious to get right in shell.

## What the action adds

- Outputs for the fields CI usually needs, with missing fields as empty strings instead of `null`.
- A not-found failure with a readable message, rather than parsing CLI stderr.
- Log groups, a color-coded status, a job summary, and warning annotations.
- No runner requirements: the AWS SDK is bundled, so it doesn't depend on the AWS CLI or `jq`.

## Why it calls the SDK, not the CLI

The CLI's error output changed in version 2.34, which made "enhanced" error formatting the default, and AWS CLI v1 formats errors differently again. Matching on stderr text would need a branch per version. The SDK returns a typed `ResourceNotFoundException`, so the action behaves the same on every runner.

## Why no MWAA tokens

MWAA's CLI and web login tokens (`aws mwaa create-cli-token`) exist to run Airflow commands and open the Airflow UI. `GetEnvironment` is an ordinary AWS API call authorized by IAM, so it works with the credentials from `configure-aws-credentials` and needs no tokens.

## Scope

The action reads an environment and reports it. It never changes the environment. Updating an environment is a separate concern, covered by [mwaa-update-env-action](https://github.com/lowlysre/mwaa-update-env-action), which uses the same output names.
