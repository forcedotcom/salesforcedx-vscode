# Salesforce Apex Library

[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)

## Introduction
Typescript library to support the [Salesforce Extensions for VS Code](https://github.com/forcedotcom/salesforcedx-vscode/) and the [Apex Plugin for the Salesforce CLI](https://github.com/salesforcecli/plugin-apex).

Note: Please report any issues via the [Issues tab](https://github.com/forcedotcom/salesforcedx-apex/issues).

<br/>

## API entry points

- `@salesforce/apex-node` is the backward-compatible Promise and class API.
- `@salesforce/apex-node/effect` is the primary API for new Effect operations, schemas, errors, and host capabilities.

## Consuming the two APIs

Choose the entry point based on the consumer's programming model, regardless of where it runs:

| Consumer | Entry point | Contract |
| --- | --- | --- |
| Promise/class code | `@salesforce/apex-node` | Construct a class with a connection and `await` its methods. The caller does not need to use Effect. |
| Effect code | `@salesforce/apex-node/effect` | Compose Effect operations, provide their required layers, and handle typed errors in the Effect error channel. |

For example, the existing Promise API executes anonymous Apex as follows. `connection` is a `@salesforce/core` connection selected by the caller:

```ts
import { ExecuteService } from '@salesforce/apex-node';

const result = await new ExecuteService(connection).executeAnonymous({
  apexCode: 'System.debug(1);'
});
```

The Effect API will expose the same Apex behavior as pure Effect operations. This foundation release only exposes errors and a connection capability; execute, log, and test operations have not migrated yet. The following Effect demonstrates how those operations will obtain a connection from their environment:

```ts
import { ApexConnectionProvider, apexConnectionLayer } from '@salesforce/apex-node/effect';
import * as Effect from 'effect/Effect';

const currentConnection = ApexConnectionProvider.pipe(
  Effect.flatMap(provider => provider.getConnection)
);

const selectedConnection = await Effect.runPromise(
  currentConnection.pipe(Effect.provide(apexConnectionLayer(connection)))
);
```

How a consumer obtains the connection is separate from which API it chooses. The fixed layer above uses a caller-owned connection; a shared services layer can provide the same capability from a host's connection service. A caller that needs a specific org selects or validates its connection before providing the fixed layer. As Apex behavior migrates, the Promise classes will run the Effect implementation internally while keeping their Promise return types and existing results.

## Getting Started

If you're interested in contributing, take a look at the [CONTRIBUTING](./CONTRIBUTING.md) guide.

If you're interested in building the plugin and library locally, take a look at the [Developing](./contributing/developing.md) doc.
