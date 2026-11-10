# Apex: Effect-native result file writing (PR #8518)

Branch `sm/W-23839447`. Goal: `writeResultFiles` runs on web; apex-testing stops duplicating library writers.

## Decisions

- Effect impl is real; `TestService.writeResultFiles` wraps it
- FS by injection (Effect tag), not `@salesforce/core/fs` global. Web bundles each get own memfs `Volume`; only services' `FsService` uses the workspace FS. Host passes the `FsService` service implementation.
- Tag = Apex-owned, names mirror `FsService`: `createDirectory`, `writeFile(directory, fileName, Stream<string>)`. No read/stat operations; current Effect writers only write
- Node default service streams to `node:fs`; desktop `TestService` uses it. Web injects the services-owned `FsService` adapter, which collects and calls `safeWriteFile`.
- JSON output compact. No `indent` option
- JSON as string generators. `TestResultStringifyStream` -> generator, byte-identical. Coverage array -> generator. `fileInfo.content` strings remain raw; objects use `JSON.stringify`. Drop `json-stream-stringify`.
- Extension result JSON and async raw-result files pass `includeSetup: true` to preserve the extension's existing setup rows; default library writer stays parity-compatible (omits setup)
- Markdown/text keeps `Stream` generators. New `lineEnding` option (default `\n`, matches TAP). Delete extension `newlineUtils.ts` + test
- No-run-id filename: always `test-result-default.*`. No override option. Extension only runs async (always has id); `test-result.json` fallback is dead code
- `-codecoverage.json`: library rule (written when `codeCoverage` true). Drop extension's `tests.length` gate (empty -> `[]`)
- Streaming kept for large results: apex PR #352 (string-length failures), PR #606 review (concat risky)

## Verified facts

- `@effect/platform` `FileSystem` is too broad and has no ready web implementation; removed its unused direct Apex dependency
- `node:stream/promises` aliased to empty in `web.mjs` -> `pipeline` undefined on web
- Standalone `writeResultFiles`, `TestResultStringifyStream` not in public API (`index.ts`). `TestService.writeResultFiles` + `OutputDirConfig` are
- Only caller of `TestService.writeResultFiles` in repo: replay-debugger `quickLaunch.ts` (json only)
- Apex Testing writers now use the shared Effect writer through the `FsService` adapter
- Upstream parity tests (`test/tests/upstreamParity/`) lock `writeResultFiles` bytes vs apex-node 9.1.13 -> must still pass

## Steps

1. [x] FileOutput tag + Node service/layer + FsService-backed service adapter
2. [x] Generators: result JSON port, coverage JSON
3. [x] `lineEnding` option on Markdown/text formatter
4. [x] Effect `writeResultFiles` in `./effect`; options: `sortOrder`, thresholds, `timestamp`, `lineEnding`, `codeCoverage`, `includeSetup`, `writeTestRunId`
5. [x] `TestService.writeResultFiles` wrapper; remove `runPipeline`, `reportStreamToReadable`, `Readable` from `testService.ts`
6. [x] `asyncTests.writeAsyncResultsToFile`, `fileSystemHandler.createFile` use FileOutput
7. [x] Extension uses shared library writers with the services-owned `FsService`; remove legacy filename fallbacks
8. [x] `CoverageReporter` stays Node-only: no in-repo production caller, and Istanbul report writing is Node-owned too
9. [x] Apex tests: 500 passed, 1 skipped; parity: 6 passed; Apex Testing: 297 passed. Lint, Effect diagnostics, schema check, Knip passed
10. [x] Web E2E: 7 passed, 7 skipped; desktop E2E: 14 passed

## Risks

- `JSON.stringify` vs `JsonStreamStringify` edge cases (`undefined`, `toJSON`, `NaN`) for caller-supplied object `fileInfo.content`
- Generator must reproduce current `TestResultStringifyStream` bytes (256-char chunking irrelevant to file bytes)
- `readTestRunIdFile` returns undefined on error -> watcher fallback now matches library's `test-result-default.json`
- File-write tests provide an in-memory FileOutput service; Node class wrappers use the default Node service.
