# Salesforce Services Extension

This extension provides core services for Salesforce development in VS Code.

## Features

- Service provider functionality
- Core utilities for Salesforce development
- Integration with Salesforce CLI

## Requirements

- VS Code 1.90.0 or higher
- Salesforce CLI

## Installation

This extension is part of the Salesforce Extensions for VS Code package.

## Usage

This extension provides services used by other Salesforce extensions and is not directly user-facing.

## Usage Example: Consuming Services from Other Extensions

**Important**: Do not directly import from `salesforcedx-vscode-services`. Instead, access services through the extension API.

### Step 1: Create an Extension Provider

Create a file `src/services/extensionProvider.ts` in your extension:

```ts
import * as Context from 'effect/Context';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';

export class ServicesExtensionNotFoundError extends Data.TaggedError('ServicesExtensionNotFoundError') {}
export class InvalidServicesApiError extends Data.TaggedError('InvalidServicesApiError')<{ cause?: Error }> {}

export type ExtensionProviderService = {
  readonly getServicesApi: Effect.Effect<
    SalesforceVSCodeServicesApi,
    ServicesExtensionNotFoundError | InvalidServicesApiError,
    never
  >;
};

export const ExtensionProviderService = Context.GenericTag<ExtensionProviderService>('ExtensionProviderService');

const getServicesApi = Effect.sync(() =>
  vscode.extensions.getExtension<SalesforceVSCodeServicesApi>('salesforce.salesforcedx-vscode-services')
).pipe(
  Effect.flatMap(ext => (ext ? Effect.succeed(ext) : Effect.fail(new ServicesExtensionNotFoundError()))),
  Effect.flatMap(ext =>
    ext.isActive
      ? Effect.sync(() => ext.exports)
      : Effect.tryPromise({
          try: () => ext.activate(),
          catch: e => new InvalidServicesApiError(e instanceof Error ? { cause: e } : { cause: new Error(String(e)) })
        })
  )
);

const ExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({
    getServicesApi
  }))
);

export const AllServicesLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const extensionProvider = yield* ExtensionProviderService;
    const api = yield* extensionProvider.getServicesApi;
    return Layer.mergeAll(
      ExtensionProviderServiceLive,
      api.services.ConfigService.Default,
      api.services.WorkspaceService.Default // Required dependency of ConfigService
      // Add other services and their dependencies as needed
    );
  }).pipe(Effect.provide(ExtensionProviderServiceLive))
);
```

### Step 2: Use Services in Your Effect Programs

```ts
import * as Effect from 'effect/Effect';
import { AllServicesLayer, ExtensionProviderService } from './services/extensionProvider';

const myProgram = Effect.gen(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const configService = yield* api.services.ConfigService;
  const configAggregator = yield* configService.getConfigAggregator;
  return configAggregator;
});

Effect.runPromise(myProgram.pipe(Effect.provide(AllServicesLayer)));
```

See `packages/salesforcedx-vscode-metadata/src/services/extensionProvider.ts` for a complete example.

## Contributing

Please see the [contributing guide](../../CONTRIBUTING.md) for details on how to contribute to this project.

## License

[BSD 3-Clause License](LICENSE.txt)
