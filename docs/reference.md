# Reference

- [Inputs](#inputs)
- [Outputs](#outputs)
- [Logs, annotations, and failures](#logs-annotations-and-failures)

## Inputs

| Input     | Required | Default                              | Description                                                                                     |
|-----------|----------|--------------------------------------|-------------------------------------------------------------------------------------------------|
| `name`    | yes      |                                      | Name of the MWAA environment. Must match `[a-zA-Z][0-9a-zA-Z-_]*` and be at most 80 characters. |
| `region`  | no       | `AWS_REGION` or `AWS_DEFAULT_REGION` | AWS region of the environment.                                                                  |
| `summary` | no       | `true`                               | Write an environment summary to the job summary page.                                           |

The action reads credentials from the standard AWS provider chain, so run [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials) first. See [permissions](permissions.md) for the IAM policy.

## Outputs

Fields the environment doesn't set are returned as empty strings. Output names are the kebab-case form of the [`GetEnvironment` response](https://docs.aws.amazon.com/mwaa/latest/API/API_GetEnvironment.html) field names, except `environment-arn` for `Arn`. They match the names used by [mwaa-update-env-action](https://github.com/lowlysre/mwaa-update-env-action), so values pass between the two actions without renaming.

| Output                             | Source field                   |
|------------------------------------|--------------------------------|
| `name`                             | `Name`                         |
| `status`                           | `Status`                       |
| `environment-arn`                  | `Arn`                          |
| `airflow-version`                  | `AirflowVersion`               |
| `environment-class`                | `EnvironmentClass`             |
| `webserver-url`                    | `WebserverUrl`                 |
| `source-bucket-arn`                | `SourceBucketArn`              |
| `dag-s3-path`                      | `DagS3Path`                    |
| `requirements-s3-path`             | `RequirementsS3Path`           |
| `requirements-s3-object-version`   | `RequirementsS3ObjectVersion`  |
| `plugins-s3-path`                  | `PluginsS3Path`                |
| `plugins-s3-object-version`        | `PluginsS3ObjectVersion`       |
| `startup-script-s3-path`           | `StartupScriptS3Path`          |
| `startup-script-s3-object-version` | `StartupScriptS3ObjectVersion` |
| `last-update-status`               | `LastUpdate.Status`            |
| `json`                             | The full `Environment` object  |

`json` holds every field, including those without a dedicated output (networking, logging, tags, worker counts), so read them with `fromJSON`. Timestamps are ISO 8601 strings.

`status` is one of `CREATING`, `CREATE_FAILED`, `AVAILABLE`, `UPDATING`, `DELETING`, `DELETED`, `UNAVAILABLE`, `UPDATE_FAILED`, `ROLLING_BACK`, `CREATING_SNAPSHOT`, `PENDING`, or `MAINTENANCE`. `last-update-status` is `SUCCESS`, `PENDING`, or `FAILED`.

## Logs, annotations, and failures

The log shows `status` and `last-update-status` as colored dots. The job summary shows them as colored circles, because it doesn't render ANSI colors.

| Color  | Statuses                                                             |
|--------|----------------------------------------------------------------------|
| Green  | `AVAILABLE`, `SUCCESS`                                               |
| Blue   | Any other status, such as `UPDATING`, `CREATING`, or `PENDING`       |
| Yellow | `ROLLING_BACK`, `MAINTENANCE`                                        |
| Red    | `CREATE_FAILED`, `UPDATE_FAILED`, `UNAVAILABLE`, `DELETED`, `FAILED` |
| Gray   | No status                                                            |

A red `status`, or a `last-update-status` of `FAILED`, also adds a warning annotation without failing the step, so your workflow decides what to do with the outputs.

The step fails with an error annotation, and sets no outputs, when:

| Cause                     | Message                                                                  |
|---------------------------|--------------------------------------------------------------------------|
| Environment doesn't exist | `MWAA environment '<name>' was not found in region <region>.`            |
| Missing IAM permission    | `Access denied calling airflow:GetEnvironment for '<name>' in <region>.` |
| Invalid name or no region | `Invalid environment name '<name>': ...` or `No AWS region: ...`         |
| Any other AWS error       | `GetEnvironment failed for '<name>' in <region>: <ErrorName>: <message>` |
