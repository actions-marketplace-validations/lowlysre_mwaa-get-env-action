# Update an environment and verify it

This workflow reads the environment with this action, applies a change with [mwaa-update-env-action](https://github.com/lowlysre/mwaa-update-env-action), waits for the environment to be `AVAILABLE` again, and reads the environment once more to confirm the change.

> [!NOTE]
> The examples use `@v1` as a placeholder. Neither action has a release yet. Once they do, pin both to a full commit SHA with the release tag in a comment.

The two actions share names, so the outputs here feed the update action's inputs directly: `requirements-s3-object-version`, `plugins-s3-object-version`, `startup-script-s3-object-version`, `environment-class`, `airflow-version`, and the S3 path fields use the same spelling in both.

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

  - id: update
    uses: lowlysre/mwaa-update-env-action@v1
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

## Notes

- The first read fails fast if the environment is mid-update or unhealthy, before anything is uploaded.
- The upload step needs `s3:PutObject` on the source bucket and a versioned bucket, in addition to the permissions of each action. See [permissions](permissions.md) for this action's and the update action's documentation for its own.
- `wait: true` makes the update step block until the environment is `AVAILABLE` and fail if the update fails. The final read is an independent check that doesn't trust the update step's own report.
- Set `summary: false` on the repeated reads so the job summary isn't filled with duplicate tables.
