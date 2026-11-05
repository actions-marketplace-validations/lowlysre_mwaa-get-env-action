# Inputs, outputs, and errors

## Inputs

| Input     | Required | Default                              | Description                                                                                     |
| --------- | -------- | ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `name`    | yes      |                                      | Name of the MWAA environment. Must match `[a-zA-Z][0-9a-zA-Z-_]*` and be at most 80 characters. |
| `region`  | no       | `AWS_REGION` or `AWS_DEFAULT_REGION` | AWS region of the environment.                                                                  |
| `summary` | no       | `true`                               | Write an environment summary to the job summary page.                                           |

The action reads credentials from the standard AWS provider chain, so run [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials) first. See [permissions](../how-to/permissions.md) for the IAM policy.

## Outputs

Fields the environment doesn't set are returned as empty strings. Output names are the snake_case form of the [`GetEnvironment` response](https://docs.aws.amazon.com/mwaa/latest/API/API_GetEnvironment.html) field names.

| Output                             | Source field                   | Example                                                             |
| ---------------------------------- | ------------------------------ | ------------------------------------------------------------------- |
| `name`                             | `Name`                         | `my-environment`                                                    |
| `status`                           | `Status`                       | `AVAILABLE`                                                         |
| `arn`                              | `Arn`                          | `arn:aws:airflow:us-east-1:123456789012:environment/my-environment` |
| `airflow_version`                  | `AirflowVersion`               | `2.10.3`                                                            |
| `environment_class`                | `EnvironmentClass`             | `mw1.small`                                                         |
| `webserver_url`                    | `WebserverUrl`                 | `a1b2c3d4.c10.us-east-1.airflow.amazonaws.com`                      |
| `source_bucket_arn`                | `SourceBucketArn`              | `arn:aws:s3:::my-airflow-bucket`                                    |
| `dag_s3_path`                      | `DagS3Path`                    | `dags`                                                              |
| `requirements_s3_path`             | `RequirementsS3Path`           | `requirements.txt`                                                  |
| `requirements_s3_object_version`   | `RequirementsS3ObjectVersion`  | S3 version ID                                                       |
| `plugins_s3_path`                  | `PluginsS3Path`                | `plugins.zip`                                                       |
| `plugins_s3_object_version`        | `PluginsS3ObjectVersion`       | S3 version ID                                                       |
| `startup_script_s3_path`           | `StartupScriptS3Path`          | `startup.sh`                                                        |
| `startup_script_s3_object_version` | `StartupScriptS3ObjectVersion` | S3 version ID                                                       |
| `last_update_status`               | `LastUpdate.Status`            | `SUCCESS`, `PENDING`, or `FAILED`                                   |
| `json`                             | `Environment`                  | The full object as JSON                                             |

`json` is the complete `Environment` object, so fields without a dedicated output (networking, logging, tags, worker counts) are available through `fromJSON`. Timestamps are ISO 8601 strings.

### Status values

`status` is one of `CREATING`, `CREATE_FAILED`, `AVAILABLE`, `UPDATING`, `DELETING`, `DELETED`, `UNAVAILABLE`, `UPDATE_FAILED`, `ROLLING_BACK`, `CREATING_SNAPSHOT`, `PENDING`, or `MAINTENANCE`. The log colors `AVAILABLE` green, `CREATE_FAILED`, `UPDATE_FAILED`, `UNAVAILABLE`, and `DELETED` red, and everything else yellow.

## Annotations and failures

The action adds a warning annotation, without failing the step, when `status` is `CREATE_FAILED`, `UPDATE_FAILED`, `UNAVAILABLE`, or `DELETED`, or when `last_update_status` is `FAILED`. Use the outputs to decide what your workflow does next.

The action fails the step with an error annotation when:

| Cause                     | Message                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| Environment doesn't exist | `MWAA environment '<name>' was not found in region <region>.`            |
| Missing IAM permission    | `Access denied calling airflow:GetEnvironment for '<name>' in <region>.` |
| Invalid environment name  | `Invalid environment name '<name>': ...`                                 |
| No region                 | `No AWS region: set the 'region' input or AWS_REGION ...`                |
| Any other AWS error       | `GetEnvironment failed for '<name>' in <region>: <ErrorName>: <message>` |

No outputs are set when the step fails.
