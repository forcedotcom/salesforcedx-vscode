# Salesforce Apex Library

[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)

## Introduction

Typescript library to support the [Salesforce Extensions for VS Code](https://github.com/forcedotcom/salesforcedx-vscode/) and the [Apex Plugin for the Salesforce CLI](https://github.com/salesforcecli/plugin-apex).

Note: Please report any issues via the [Issues tab](https://github.com/forcedotcom/salesforcedx-apex/issues).

<br/>

## API entry points

- `@salesforce/apex-node` is the backward-compatible Promise and class API.
- `@salesforce/apex-node/effect` is the primary API for new Effect operations, schemas, and errors.

## Using the Effect API

The existing Promise/class entry point remains available for its current consumers. New Apex behavior is developed in `@salesforce/apex-node/effect`. Execute anonymous and code coverage retrieval share Effect implementations with their Promise adapters.

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

### Logs

`listLogs(connection, limit = 25, options?)` queries Tooling API logs in descending start-time order. Options filter by user(s), operation substring, and inclusive start time. `getLogBody(connection, logId)` retrieves the body.

`streamLogs(connection, options)` collects immediately and then on the supplied Effect schedule. `pollOptions(index)` returns `Option.none()` to skip a poll or `Option.some(filters)` to query; `filterLogs` selects records before body retrieval. The stream emits `Log`, `QueryError`, and `BodyError` events, continuing after request failures. Consumers own window gating, trace flags, org changes, deduplication, storage, and interruption.

### Code coverage retrieval

`@salesforce/apex-node/effect` exports three coverage operations, each taking the caller-selected connection:

- `getOrgWideCoverage(connection)` returns a percentage string, or `'0%'` if no record exists.
- `getPerClassCodeCoverage(connection, apexTestClassIds)` takes a `ReadonlySet<string>` and returns a `Map<string, PerClassCoverage[]>` keyed by `${testClassId}-${methodName}`. An empty set returns an empty map without querying.
- `getAggregateCodeCoverage(connection, apexClassIds)` takes a `ReadonlySet<string>` and returns `{ codeCoverageResults, totalLines, coveredLines }`. An empty set queries all aggregate records, preserving the org's **Store Only Aggregate Code Coverage** behavior.

Both ID-filtered operations batch at 500 IDs and retrieve every Tooling query page. Request failures use `ApexOperationError`; malformed responses use `ApexResponseDecodeError`. Interruption stops further retrieval, but cannot cancel a request already submitted through the connection.

Coverage schemas are exported from `./effect`. The existing root coverage types derive from those schemas without changing their fields, string IDs, mutable arrays, optional per-test coverage, or percentage rounding. Existing `TestService` consumers continue to use the Promise adapter; test execution, reporting, and coverage decorations are unchanged.

## Getting Started

If you're interested in contributing, take a look at the [CONTRIBUTING](./CONTRIBUTING.md) guide.

If you're interested in building the plugin and library locally, take a look at the [Developing](./contributing/developing.md) doc.
