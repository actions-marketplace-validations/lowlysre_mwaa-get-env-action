# Recipes

Each recipe assumes AWS credentials are already configured and the action step has `id: mwaa`. The examples use `@v1` as a placeholder because neither this action nor its sibling has a release yet. Once they do, pin both to a full commit SHA with the release tag in a comment.

<!-- toc -->

- [Check whether an environment exists](#check-whether-an-environment-exists)
- [Block a deploy unless the environment is healthy](#block-a-deploy-unless-the-environment-is-healthy)
- [Detect drift between S3 and the environment](#detect-drift-between-s3-and-the-environment)
- [Read other fields, or many environments](#read-other-fields-or-many-environments)
- [Update an environment and verify it](#update-an-environment-and-verify-it)

<!-- tocstop -->

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

`outcome` is `failure` for any error, including access denied. The step's error annotation tells the causes apart.

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

## Detect drift between S3 and the environment

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

This needs a versioned bucket and `s3:GetObjectVersion` on it, in addition to the [action's permission](permissions.md).

## Read other fields, or many environments

`json` holds the full `Environment` object.

```yaml
- run: echo "Subnets: ${{ join(fromJSON(steps.mwaa.outputs.json).NetworkConfiguration.SubnetIds, ', ') }}"
```

Set `summary: false` when the step runs many times in one job, for example in a matrix over environments, so the job summary isn't filled with duplicate tables.

## Update an environment and verify it

[mwaa-update-env-action](https://github.com/lowlysre/mwaa-update-env-action) changes an environment. The two actions share names, so the outputs here feed its inputs directly. This workflow reads the environment, uploads a new `requirements.txt`, updates the environment and waits for `AVAILABLE`, then reads it again to confirm.

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: actions/checkout@v7 # pin to a full commit SHA in production

  - uses: aws-actions/configure-aws-credentials@v6
    with:
      role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
      aws-region: us-east-1

  - id: before
    uses: lowlysre/mwaa-get-env-action@v1
    with:
      name: my-environment

  - name: Require an idle environment
    if: steps.before.outputs.status != 'AVAILABLE'
    run: |
      echo "::error::Environment is ${{ steps.before.outputs.status }}, not AVAILABLE"
      exit 1

  - name: Upload requirements.txt
    id: upload
    env:
      BUCKET_ARN: ${{ steps.before.outputs.source-bucket-arn }}
      KEY: ${{ steps.before.outputs.requirements-s3-path }}
    run: |
      version=$(aws s3api put-object --bucket "${BUCKET_ARN##*:::}" --key "$KEY" \
        --body requirements.txt --query VersionId --output text)
      echo "version=$version" >> "$GITHUB_OUTPUT"

  - uses: lowlysre/mwaa-update-env-action@v1
    with:
      name: my-environment
      requirements-s3-object-version: ${{ steps.upload.outputs.version }}
      wait: true

  - id: after
    uses: lowlysre/mwaa-get-env-action@v1
    with:
      name: my-environment
      summary: false

  - name: Confirm the update took effect
    env:
      EXPECTED: ${{ steps.upload.outputs.version }}
      ACTUAL: ${{ steps.after.outputs.requirements-s3-object-version }}
      LAST_UPDATE: ${{ steps.after.outputs.last-update-status }}
    run: |
      if [ "$ACTUAL" != "$EXPECTED" ] || [ "$LAST_UPDATE" != "SUCCESS" ]; then
        echo "::error::Expected requirements version $EXPECTED with a successful update, got $ACTUAL ($LAST_UPDATE)"
        exit 1
      fi
```

The first read fails fast if the environment is mid-update or unhealthy, before anything is uploaded. The upload needs `s3:PutObject` on a versioned source bucket, and each action has its own permissions. `wait: true` makes the update step block until the environment is `AVAILABLE` and fail if the update fails. The final read is an independent check that doesn't rely on the update step's own report.
