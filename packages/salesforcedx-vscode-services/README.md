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

## Usage Example: Composing Services with Effect

```ts
import { Effect, pipe } from 'effect';
import { ConfigService, ConfigServiceLive } from './src/core/configService';
import { WorkspaceServiceLive } from './src/vscode/workspaceService';

// Effect program to get a ConfigAggregator
const program = ConfigService.getConfigAggregator;

pipe(
  program,
  Effect.provideLayer(WorkspaceServiceLive), // provide WorkspaceService
  Effect.provideLayer(ConfigServiceLive), // provide ConfigService (depends on WorkspaceService)
  Effect.runPromise
).then(console.log, console.error);
```

## Contributing

Please see the [contributing guide](../../CONTRIBUTING.md) for details on how to contribute to this project.

## License

[BSD 3-Clause License](LICENSE.txt)
