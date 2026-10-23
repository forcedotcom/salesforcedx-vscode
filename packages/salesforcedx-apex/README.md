# Salesforce Apex Library

[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)

## Introduction

Typescript library to support the [Salesforce Extensions for VS Code](https://github.com/forcedotcom/salesforcedx-vscode/) and the [Apex Plugin for the Salesforce CLI](https://github.com/salesforcecli/plugin-apex).

Note: Please report any issues via the [Issues tab](https://github.com/forcedotcom/salesforcedx-apex/issues).

<br/>

## API entry points

- `@salesforce/apex-node` is the Promise and class API for existing consumers.
- `@salesforce/apex-node/effect` is the primary API for new Effect operations, schemas, and errors.

## Using the Effect API

The existing Promise/class entry point remains available for its current consumers. New Apex behavior is developed in `@salesforce/apex-node/effect`. `ExecuteService` adapts the shared Effect implementation to the CLI response and Promise error contracts; other classes have not migrated yet.

### Effect API with an explicit connection

`executeAnonymous(connection, options)` is exported from `@salesforce/apex-node/effect`. It returns an Effect with typed operation and response errors. The consumer selects the connection and supplies Apex source text; file reading and terminal input belong to the consumer.

An extension can obtain the current connection from services for each operation:

```ts
import { executeAnonymous } from '@salesforce/apex-node/effect';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';

const executeWithServices = Effect.gen(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const connection = yield* api.services.ConnectionService.getConnection();
  return yield* executeAnonymous(connection, { apexCode: 'System.debug(1);' });
});
```

The services extension also keeps its `ExecuteAnonymousService` API for callers that need its result shape and editor reporting. Its execution method delegates to `executeAnonymous`:

```ts
const api = yield * (yield * ExtensionProviderService).getServicesApi;
const { result, logBody, logId } = yield * api.services.ExecuteAnonymousService.executeAndRetrieveLog(code);
```

A consumer outside VS Code passes its own connection without depending on services:

```ts
import { executeAnonymous } from '@salesforce/apex-node/effect';
import * as Effect from 'effect/Effect';

const result = await Effect.runPromise(executeAnonymous(connection, { apexCode: 'System.debug(1);' }));
```

### Consumer-owned Effect injection

A consumer may still use Effect layers to select a connection. Its own tag and layer supply the connection; `apex-node` does not require a package connection tag. For example, a consumer outside VS Code can compose a connection layer with the Apex operation:

```ts
import { executeAnonymous } from '@salesforce/apex-node/effect';
import type { Connection } from '@salesforce/core';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

const AppConnection = Context.GenericTag<Connection>('my-app/Connection');
const connectionLayer = Layer.succeed(AppConnection, connection);
const operation = AppConnection.pipe(
  Effect.flatMap(selected => executeAnonymous(selected, { apexCode: 'System.debug(1);' }))
);
const result = await Effect.runPromise(operation.pipe(Effect.provide(connectionLayer)));
```

A fixed layer captures its connection when constructed. An extension that needs the current default org should resolve the connection for each operation, as in the services example.

<<<<<<< HEAD
### Asynchronous test execution

`runTestAsynchronous(connection, options, polling?)` returns a lazy, scoped Stream. Consuming it submits the Tooling API request, emits `Started` with the test run ID, then polls `ApexTestRunResult`. Each `Progress` value contains the status and completed/enqueued class counts. The terminal status is emitted before the stream ends. Request and malformed-response failures use `ApexOperationError` and `ApexResponseDecodeError`.

```ts
import { runTestAsynchronous } from '@salesforce/apex-node/effect';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';

const run = runTestAsynchronous(connection, { testLevel: 'RunLocalTests' }).pipe(
  Stream.runForEach(progress => Effect.log(progress)),
  Effect.scoped
);
await Effect.runPromise(run);
```

The caller owns the scope. Interruption stops polling; closing the scope before completion waits for unfinished queue items to be aborted, including paginated queue items. Submission is uninterruptible until the accepted run ID is known, so cancellation during submission can still abort the remote run. Cleanup failures surface as defects rather than being silently ignored. Keep the scope around the stream consumer, not the entire application.

Polling defaults to one second; `polling.interval` accepts an Effect `DurationInput`. There is no CometD fallback. Consumers own deadlines (for example, `Effect.timeout` around `run`) and UI formatting. Once submission settles and the run ID is known, a deadline stops polling, closes the scope, and waits for unfinished tests to be aborted; it does not detach the run. A deadline cannot interrupt a pending submission or cleanup, so it does not bound the total duration of `run`. To intentionally leave tests running, use `{ exitOnTestRunId: true }`, which emits only `Started` without polling or aborting. This API reports execution progress; result formatting, coverage, and file output remain separate operations.

For the next major, the Promise API keeps `CancellationTokenSource` and its minimal cancellation contract because [plugin-apex](https://github.com/salesforcecli/plugin-apex/blob/c8fdf7073ce194deb75fc7fd12c0b981ee2b97f4/src/shared/TestRunService.ts) and [plugin-flow](https://github.com/salesforcecli/plugin-flow/blob/37032aadfd665266184a7f71b18b133e1b55e25f/src/commands/flow/run/test.ts) use them. The generic, VS Code-derived `Progress<T>` export is removed; Promise test methods instead accept the concrete `ApexTestProgressReporter` (`{ report(value: ApexTestProgressValue): void }`). Existing reporter objects need no runtime changes. Neither cancellation tokens nor reporter callbacks are used by the Effect API.
=======
### Execute anonymous input migration

The Effect API requires `{ apexCode: string }` and never reads files or terminal input. `ExecuteService.executeAnonymous` accepts `{ apexCode: string | Buffer }` and retains the existing `apexFilePath` and `userInput` options for CLI compatibility. Explicit source content takes precedence; an empty source string is submitted to Salesforce for validation.

```ts
import { readFile } from 'node:fs/promises';
import { ExecuteService } from '@salesforce/apex-node';

const apexCode = await readFile(file, 'utf8');
const result = await new ExecuteService(connection).executeAnonymous({ apexCode });
```

The [CLI command at c8fdf707](https://github.com/salesforcecli/plugin-apex/blob/c8fdf7073ce194deb75fc7fd12c0b981ee2b97f4/src/commands/apex/run.ts) still passes `apexFilePath` or `userInput`. The class retains those reads, the input prompt, per-line 60-second idle timeout, platform line endings, and input-error messages. **Do not remove these options until the CLI reads `--file` or stdin itself, passes `apexCode`, and verifies file, piped-input, interactive-input, timeout, and error cases.** That consumer migration is not included here; this change preserves its existing input contract.

The Effect API returns a success-only outcome. Compilation and runtime failures use `ApexCompileError` and `ApexRuntimeError`, carrying host-neutral line/column, diagnostic text, and any debug log; malformed SOAP produces `ApexResponseDecodeError`. `ExecuteService` adapts compile/runtime errors back to the CLI's `compiled`, `success`, `logs`, and `diagnostic` response, while other errors remain rejected Promises with plain messages. The VS Code services adapter handles the typed execution failures as diagnostic data for its editor and output-channel contract.
>>>>>>> origin/sm/W-23839366

## Getting Started

If you're interested in contributing, take a look at the [CONTRIBUTING](./CONTRIBUTING.md) guide.

If you're interested in building the plugin and library locally, take a look at the [Developing](./contributing/developing.md) doc.
