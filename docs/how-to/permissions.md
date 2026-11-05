# Permissions

The credentials in the job need `airflow:GetEnvironment` on the environment, and nothing else.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "airflow:GetEnvironment",
      "Resource": "arn:aws:airflow:us-east-1:123456789012:environment/my-environment"
    }
  ]
}
```

Use `environment/*` as the resource to read every environment in the account and region.

## Authenticate with GitHub OIDC

Run [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials) before this action. It exports the credentials and region, which this action reads from the standard AWS provider chain.

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@v6
    with:
      role-to-assume: arn:aws:iam::123456789012:role/mwaa-ci
      aws-region: us-east-1

  - uses: lowlysre/mwaa-get-env-action@v1
    with:
      name: my-environment
```

Long-lived access keys in the environment work the same way, but OIDC avoids storing them as secrets. See the AWS documentation on [configuring OIDC in AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws) for the trust policy.

## Troubleshooting

- `Access denied calling airflow:GetEnvironment`: the role's policy doesn't allow the action on this environment, or a permissions boundary or SCP blocks it.
- `was not found in region`: check the environment name and that `region` (or `AWS_REGION`) is the environment's region. The same name can exist in several regions.
- `No AWS region`: set the `region` input, or run configure-aws-credentials with `aws-region`.
