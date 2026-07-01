# Salesforce Services Extension

This extension provides core services for Salesforce development in VS Code.

## Features

- Service provider functionality (Workspace, Connection, Project, Config, FS, Channel, Media, Prompt, Template)
- Core utilities for Salesforce development
- Integration with Salesforce CLI
- Metadata operations:
  - Deploy/retrieve with owned outcome types (DeployOutcome, RetrieveOutcome)
  - Metadata describe with owned `MetadataTypeInfo` DTO (mirrors jsforce DescribeMetadataObject)
- Source tracking — query local, remote, conflict changes as owned OrgChange DTOs
- Template generation through `@salesforce/templates`:
  - Owned `TemplateCreateOutcome` return via `createFromTemplateOwned()` (data-only DTO)
- Virtual FS provider (`src/virtualFsProvider`) — memfs, IndexedDB storage for web
- Observability (`src/observability`) — OpenTelemetry spans, App Insights, O11y. See [observability README](src/observability/README.md)

## Requirements

- VS Code 1.90.0 or higher
- Salesforce CLI

## Installation

This extension is part of the Salesforce Extensions for VS Code package.

## Owned Data Types (Import-Free DTOs)

The services API publishes owned, hand-authored data-only types with zero dependencies on `@salesforce/*`, `jsforce`, or `effect`:

- **`MetadataTypeInfo`** — Metadata type descriptor (mirrors jsforce DescribeMetadataObject, data-only)
- **`TemplateCreateOutcome`** — Template generation result (mirrors @salesforce/templates CreateOutput, data-only)
- **`ConnectionData`** — Auth/org connection info
- **`DeployOutcome`** / **`RetrieveOutcome`** — Metadata operation results (success flag, status, file responses, component failures)
- **`FileResponseInfo`** — Per-file deploy/retrieve status (name, type, state, error details)
- **`ComponentFailureInfo`** — Server-reported component failure from org deployment response
- **`DeployFromSourceOptions`** / **`RetrieveOptions`** — Metadata operation request options
- **`SourceSpec`** — Request spec for deploy/retrieve (paths, manifest, or project directories)
- **`OrgChange`** — Source tracking change entry (fullName, type, state, filePath)
- **`ProjectInfo`** — Project and package directory metadata
- **`ComponentSetInfo`** — Component introspection (describes components and package.xml)
- **`DefaultOrgInfo`** — Target org information
- **`ServicesOrg`** — Loan facade for org operations (query, crud, request, identity)

These types enable consumers to build on the services API without importing the Salesforce SDK. See [services-extension-consumption](../.claude/skills/services-extension-consumption/SKILL.md) for consumption patterns.

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
