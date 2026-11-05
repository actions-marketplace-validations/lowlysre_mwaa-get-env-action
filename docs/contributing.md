# Contributing

```sh
npm ci
npm run check
```

`npm run check` type-checks with `tsc`, runs the tests with the built-in Node test runner, and rebuilds `dist/`.

## Layout

| Path                | Purpose                                                         |
|---------------------|-----------------------------------------------------------------|
| `src/index.ts`      | Entry point.                                                    |
| `src/main.ts`       | Reads inputs, calls `GetEnvironment`, sets outputs and summary. |
| `src/format.ts`     | Status classification, colors, and the output mapping.          |
| `test/main.test.ts` | Tests against a mocked SDK and against a local HTTP server.     |
| `dist/index.cjs`    | The bundled action that runs on the runner.                     |
| `scripts/`          | Build script and the third-party license generator.             |
| `.github/linters/`  | MegaLinter, Prettier, cspell, and markdownlint configuration.   |

## Tests

The tests use `node:test`, and Node 24 runs the TypeScript directly, so there is no test build step. Most tests mock the SDK client with `aws-sdk-client-mock`. The rest point the real SDK at a local HTTP server that returns 200, 403, and 404 responses, which exercises the SDK's error deserialization.

## The dist directory

The action runs from `dist/index.cjs`, so commit the rebuilt file with source changes. CI rebuilds it and fails when the committed copy is stale.
