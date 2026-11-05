# mwaa-get-env-action

Gets the details of an Amazon MWAA environment (the `GetEnvironment` API, same data as `aws mwaa get-environment`) and exposes them as step outputs, log groups, and a job summary. It uses the AWS credentials already in the job environment, so no MWAA CLI or web login tokens are involved.

The step fails with a clear error when the environment does not exist, which makes it usable as an existence check.

## Usage

Run [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials) first, then this action:

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@v6
    with:
      role-to-assume: arn:aws:iam::123456789012:role/mwaa-ci
      aws-region: us-east-1

  - id: mwaa
    uses: lowlysre/mwaa-get-env-action@v1
    with:
      name: my-environment

  - run: echo "Airflow ${{ steps.mwaa.outputs.airflow_version }} is ${{ steps.mwaa.outputs.status }}"
```

The action runs on Node 24 and bundles the AWS SDK, so the runner needs neither the AWS CLI nor `jq`.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `name` | yes | | Name of the MWAA environment. |
| `region` | no | `AWS_REGION` or `AWS_DEFAULT_REGION` | AWS region. |
| `summary` | no | `true` | Write an environment summary to the job summary page. |

## Outputs

Fields the environment does not set are returned as empty strings.

| Output | Source field |
|---|---|
| `name` | `Name` |
| `status` | `Status` |
| `arn` | `Arn` |
| `airflow_version` | `AirflowVersion` |
| `environment_class` | `EnvironmentClass` |
| `webserver_url` | `WebserverUrl` |
| `source_bucket_arn` | `SourceBucketArn` |
| `dag_s3_path` | `DagS3Path` |
| `requirements_s3_path` | `RequirementsS3Path` |
| `requirements_s3_object_version` | `RequirementsS3ObjectVersion` |
| `plugins_s3_path` | `PluginsS3Path` |
| `plugins_s3_object_version` | `PluginsS3ObjectVersion` |
| `startup_script_s3_path` | `StartupScriptS3Path` |
| `startup_script_s3_object_version` | `StartupScriptS3ObjectVersion` |
| `last_update_status` | `LastUpdate.Status` |
| `json` | The full `Environment` object as JSON |

Parse `json` with `fromJSON` for anything not listed, for example `fromJSON(steps.mwaa.outputs.json).NetworkConfiguration`. Timestamps in `json` are ISO 8601 strings.

The output names are snake_case versions of the API field names. [mwaa-update-env-action](https://github.com/lowlysre/mwaa-update-env-action) should reuse them.

## Logs and annotations

- The log shows the environment, a color-coded status, and collapsed groups for the details and the raw JSON.
- The job summary lists the key properties and the raw JSON, unless `summary` is `false`.
- A warning annotation is added when the status is `CREATE_FAILED`, `UPDATE_FAILED`, `UNAVAILABLE`, or `DELETED`, or when the last update failed. These do not fail the step, so you can decide what to do with `status` and `last_update_status`.

## Permissions

The IAM principal needs `airflow:GetEnvironment` on the environment.

## Errors

The step fails, with an error annotation, when:

- The environment does not exist: `MWAA environment '<name>' was not found in region <region>.`
- The credentials lack permission: the message names `airflow:GetEnvironment`.
- The name is not a valid MWAA environment name, or no region can be determined.
- Any other AWS error occurs, such as throttling: the message includes the error name and text.

## Development

```sh
npm ci
npm run check
```

`npm run check` type-checks, runs the tests with the built-in Node test runner, and rebuilds `dist/`. Commit the rebuilt `dist/index.cjs`: the action runs from it, and CI fails when it is stale.

The tests cover the action against a mocked SDK client and against the real SDK pointed at a local HTTP server, so error deserialization is exercised too.

## License

[MIT](LICENSE)
