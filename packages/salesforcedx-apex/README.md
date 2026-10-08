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

The existing Promise/class entry point remains available for its current consumers. New Apex behavior is developed in `@salesforce/apex-node/effect`; this work does not add matching Promise facades or migrate existing classes.

### Effect API with an explicit connection

`executeAnonymous(connection, options)` is exported from `@salesforce/apex-node/effect`. It returns an Effect with typed operation and response errors. The consumer selects the connection and supplies Apex source text; file reading and terminal input belong to the consumer. Other Apex operations have not migrated yet.

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
const api = yield* (yield* ExtensionProviderService).getServicesApi;
const { result, logBody, logId } = yield* api.services.ExecuteAnonymousService.executeAndRetrieveLog(code);
```

A consumer outside VS Code passes its own connection without depending on services:

```ts
import { executeAnonymous } from '@salesforce/apex-node/effect';
import * as Effect from 'effect/Effect';

const result = await Effect.runPromise(
  executeAnonymous(connection, { apexCode: 'System.debug(1);' })
);
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
const result = await Effect.runPromise(
  operation.pipe(Effect.provide(connectionLayer))
);
```

A fixed layer captures its connection when constructed. An extension that needs the current default org should resolve the connection for each operation, as in the services example.

## Getting Started

If you're interested in contributing, take a look at the [CONTRIBUTING](./CONTRIBUTING.md) guide.

If you're interested in building the plugin and library locally, take a look at the [Developing](./contributing/developing.md) doc.
