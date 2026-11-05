# Recipes

Each recipe assumes AWS credentials are already configured and the action step has `id: mwaa`.

## Check whether an environment exists

The action fails when the environment is missing. Let it fail without failing the job, then branch on the step outcome.

```yaml
- id: mwaa
  uses: lowlysre/mwaa-get-env-action@v1
  continue-on-error: true
  with:
    name: my-environment

- if: steps.mwaa.outcome == 'failure'
  run: echo "Environment doesn't exist yet, create it first"
```

`outcome` is `failure` for any error, including access denied. Check the step's error annotation to tell the causes apart.

## Block a deploy unless the environment is healthy

```yaml
- id: mwaa
  uses: lowlysre/mwaa-get-env-action@v1
  with:
    name: my-environment

- name: Require an available environment
  if: steps.mwaa.outputs.status != 'AVAILABLE' || steps.mwaa.outputs.last-update-status == 'FAILED'
  run: |
    echo "::error::Environment is ${{ steps.mwaa.outputs.status }} (last update ${{ steps.mwaa.outputs.last-update-status }})"
    exit 1
```

## Detect drift between S3 and what the environment runs

An environment keeps running the object versions it was last updated with. Compare them with the latest version in the source bucket to see whether `requirements.txt` has changed since.

```yaml
- name: Compare requirements.txt versions
  env:
    BUCKET_ARN: ${{ steps.mwaa.outputs.source-bucket-arn }}
    KEY: ${{ steps.mwaa.outputs.requirements-s3-path }}
    DEPLOYED: ${{ steps.mwaa.outputs.requirements-s3-object-version }}
  run: |
    latest=$(aws s3api head-object --bucket "${BUCKET_ARN##*:::}" --key "$KEY" --query VersionId --output text)
    if [ "$latest" != "$DEPLOYED" ]; then
      echo "::notice::requirements.txt changed since the last environment update"
    fi
```

This needs `s3:GetObjectVersion` on the bucket in addition to the [action's permission](permissions.md), and a versioned bucket.

## Read a field without a dedicated output

`json` holds the full `Environment` object.

```yaml
- run: echo "Subnets: ${{ join(fromJSON(steps.mwaa.outputs.json).NetworkConfiguration.SubnetIds, ', ') }}"
```

## Update the environment

To change the environment and confirm the result, see [update an environment and verify it](update-and-verify.md), which combines this action with [mwaa-update-env-action](https://github.com/lowlysre/mwaa-update-env-action).

## Silence the job summary

Set `summary: false` when the step runs many times in one job, for example in a matrix over environments.

```yaml
- uses: lowlysre/mwaa-get-env-action@v1
  with:
    name: ${{ matrix.environment }}
    summary: false
```
