<p align="center">
  <a href="https://github.com/lowlysre/mwaa-get-env-action/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/lowlysre/mwaa-get-env-action/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/github/license/lowlysre/mwaa-get-env-action"></a>
</p>

# Get Amazon MWAA Environment

Get the details of an Amazon MWAA environment in GitHub Actions: status, Airflow version, environment class, web server URL, and the S3 paths and object versions of its requirements, plugins, and startup script. It calls the `GetEnvironment` API (the same data as `aws mwaa get-environment`) with the AWS credentials already in your job, so there are no MWAA CLI or web login tokens to manage.

The step fails with a clear error when the environment doesn't exist, so it doubles as an existence check. Every run also writes a color-coded log, a job summary, and warning annotations for unhealthy environments.

This action is built and maintained by [lowlysre](https://github.com/lowlysre). It's an independent project, not affiliated with or endorsed by AWS.

## Quick start

This example assumes the repository can use GitHub OIDC to assume an AWS role with `airflow:GetEnvironment`. See [permissions](docs/how-to/permissions.md) for the policy and trust setup.

```yaml
permissions:
  contents: read
  id-token: write

steps:
  - uses: aws-actions/configure-aws-credentials@v6
    with:
      role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
      aws-region: us-east-1

  - id: mwaa
    uses: lowlysre/mwaa-get-env-action@v1
    with:
      name: my-environment

  - run: echo "Airflow ${{ steps.mwaa.outputs.airflow_version }} is ${{ steps.mwaa.outputs.status }}"
```

The action takes the region and credentials from the AWS environment configured by the preceding step. Pin third-party actions to full commit SHAs in production workflows.

## Outputs

| Output                                                                 | Description                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------- |
| `status`, `last_update_status`                                         | Environment status and the status of its last update. |
| `arn`, `airflow_version`, `environment_class`, `webserver_url`         | Identity and sizing.                                  |
| `source_bucket_arn`, `dag_s3_path`                                     | Where DAGs live.                                      |
| `requirements_s3_path`, `plugins_s3_path`, `startup_script_s3_path`    | S3 paths of the supporting files.                     |
| `requirements_s3_object_version`, `plugins_s3_object_version`, `startup_script_s3_object_version` | S3 version IDs the environment runs. |
| `json`                                                                 | The full `Environment` object, for anything else.     |

Fields the environment doesn't set are empty strings. See [inputs, outputs, and errors](docs/reference/inputs-and-outputs.md) for every field and failure message.

## Action or the AWS CLI

`aws mwaa get-environment` works in a workflow too. The action wraps the same API for the parts that are tedious in shell.

| Need                                                  | This action                                | AWS CLI                                         |
| ----------------------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| Outputs usable in later steps                         | ✅ Built in                                | Parse JSON with `jq` yourself                   |
| Clear failure when the environment doesn't exist      | ✅ One readable message                    | Match stderr text, which varies by CLI version  |
| Works without the AWS CLI or `jq` on the runner       | ✅ SDK bundled                             | ❌                                              |
| Log groups, job summary, and failure annotations      | ✅                                         | ❌                                              |
| Update or create an environment                       | ❌ See [mwaa-update-env-action](https://github.com/lowlysre/mwaa-update-env-action) | ✅ |

See [why an action instead of the AWS CLI](docs/explanation/design.md) for the reasoning.

## Documentation

- [Inputs, outputs, and errors](docs/reference/inputs-and-outputs.md)
- [Permissions and authentication](docs/how-to/permissions.md)
- [Recipes](docs/how-to/recipes.md): existence checks, gating deploys, detecting S3 drift
- [Why an action instead of the AWS CLI](docs/explanation/design.md)
- [Contributing](docs/contributing.md)

## License

Copyright 2026 lowlysre. This action is licensed under the [MIT License](LICENSE); see [NOTICE](NOTICE) for attribution. Third-party code bundled into the action, including the AWS SDK for JavaScript v3 (Apache-2.0), is listed with each license and NOTICE in [dist/THIRD_PARTY_LICENSES.txt](dist/THIRD_PARTY_LICENSES.txt).

AWS, Amazon MWAA, and Amazon Managed Workflows for Apache Airflow are trademarks of Amazon.com, Inc. or its affiliates. This project is independent and not affiliated with or endorsed by AWS.
