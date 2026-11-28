# Salesforce Services Extension

This extension provides core services for Salesforce development in VS Code.

## Features

- Service provider functionality (Workspace, Connection, Project, Config, FS, Channel, Media, Prompt, Template)
- Core utilities for Salesforce development
- Integration with Salesforce CLI
- Template generation through `@salesforce/templates`
- Org metadata catalog with a read-only `sf-org-metadata:` document scheme for ephemeral source
- Virtual FS provider (`src/virtualFsProvider`) — memfs, IndexedDB storage for web
- Observability (`src/observability`) — OpenTelemetry spans, App Insights, O11y. See [observability README](src/observability/README.md)

## Requirements

- VS Code 1.129.0 or higher
- Salesforce CLI

## Installation

This extension is part of the Salesforce Extensions for VS Code package.

## Usage

This extension provides services used by other Salesforce extensions and is not directly user-facing.

## Usage Example: Consuming Services from Other Extensions

**Important:** First-party extensions use `api.v2.services`. The unversioned `api.services` endpoint remains the external V3 compatibility API.

### Step 1: Create an Extension Provider

Build the per-extension layer with `buildAllServicesLayer` from `@salesforce/effect-ext-utils`:

```ts
import { buildAllServicesLayer } from '@salesforce/effect-ext-utils';

export let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;
export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = layer;
};

// In activate(context):
setAllServicesLayer(buildAllServicesLayer(context, nls.localize('channel_name')));
```

### Step 2: Use Services in Your Effect Programs

```ts
import * as Effect from 'effect/Effect';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { getRuntime } from './services/runtime';

const myProgram = Effect.gen(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const configAggregator = yield* api.v2.services.ConfigService.use(service => service.getConfigAggregator());
  return configAggregator;
});

await getRuntime().runPromise(myProgram);
```

See `packages/salesforcedx-vscode-metadata/src/services/extensionProvider.ts` for a complete example.

## Contributing

Please see the [contributing guide](../../CONTRIBUTING.md) for details on how to contribute to this project.

## License

[BSD 3-Clause License](LICENSE.txt)
