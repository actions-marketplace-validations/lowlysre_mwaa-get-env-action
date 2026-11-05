# Contributing

```sh
npm ci
npm run check
```

`npm run check` type-checks with `tsc`, runs the tests with the built-in Node test runner, and rebuilds `dist/`. The test run enforces coverage thresholds of 95% for lines and functions and 70% for branches over `src/`, excluding the entry point `src/index.ts`. Run `npm run test:coverage` on its own to see the per-file report.

## Layout

| Path                | Purpose                                                         |
|---------------------|-----------------------------------------------------------------|
| `src/index.ts`      | Entry point.                                                    |
| `src/main.ts`       | Reads inputs, calls `GetEnvironment`, sets outputs and summary. |
| `src/format.ts`     | Status colors, log and summary dots, and the output mapping.    |
| `test/main.test.ts` | Tests against a mocked SDK and against a local HTTP server.     |
| `dist/index.cjs`    | The bundled action that runs on the runner.                     |
| `scripts/`          | Build script and the third-party license generator.             |
| `.github/linters/`  | MegaLinter, Prettier, cspell, and markdownlint configuration.   |
| `.github/codeql/`   | CodeQL configuration.                                           |

## Tests

The tests use `node:test`, and Node 24 runs the TypeScript directly, so there is no test build step. Most tests mock the SDK client with `aws-sdk-client-mock`. The rest point the real SDK at a local HTTP server that returns 200, 403, and 404 responses, which exercises the SDK's error deserialization.

## The dist directory

The action runs from `dist/index.cjs`, so commit the rebuilt file with source changes. CI rebuilds it and fails when the committed copy is stale.

## Workflow security

CI audits the workflows with zizmor's pedantic persona. To run the same audit locally, including the online audits, with a GitHub token:

```sh
GH_TOKEN=$(gh auth token) zizmor --persona pedantic .github
```

Every job starts with step-security/harden-runner in `block` mode, so a job that needs a new network endpoint fails until the endpoint is added to its `allowed-endpoints` list.
