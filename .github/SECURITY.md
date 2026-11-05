# Security policy

## Reporting a vulnerability

Report vulnerabilities privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**, or go straight to [the advisory form](https://github.com/lowlysre/mwaa-get-env-action/security/advisories/new). Please don't open a public issue.

Include the action version or commit SHA, the workflow snippet that triggers the problem, and what an attacker could do with it.

## Supported versions

Only the latest release gets security fixes. Releases are immutable, so a fix ships as a new version. Pin the action to a commit SHA and let Dependabot propose the update.

## Scope

In scope: the action's source in `src/`, the bundled `dist/index.cjs`, and this repository's workflows. Vulnerabilities in the AWS SDK or `@actions/core` belong upstream, but a report here still helps ship the patched dependency sooner.
