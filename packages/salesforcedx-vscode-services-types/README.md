# @salesforce/vscode-services

TypeScript type definitions for the Salesforce VS Code Services extension API.

## Overview

This package provides the legacy Effect V3 type definitions for consuming the Salesforce VS Code Services extension API. Its only runtime export is `ICONS`.

## Installation

```bash
npm install --save-dev @salesforce/vscode-services
```

## Usage

Import the type definitions in your VS Code extension to get type safety when consuming the Salesforce Services API:

```typescript
import type { SalesforceVSCodeServicesApi } from '@salesforce/vscode-services';
import * as vscode from 'vscode';

// Get the Salesforce Services extension API with proper typing
const extension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-services');
const api: SalesforceVSCodeServicesApi | undefined = extension?.exports;

if (api) {
  // Access services with full type support
  const { ConnectionService, ProjectService, ChannelService } = api.services;

  // Use the services in your extension
  // All methods and properties are fully typed
}
```

### Example: Using Services in Your Extension

```typescript
import type { SalesforceVSCodeServicesApi } from '@salesforce/vscode-services';
import * as vscode from 'vscode';

export const activate = async (context: vscode.ExtensionContext) => {
  const sfServices = vscode.extensions.getExtension<SalesforceVSCodeServicesApi>(
    'salesforce.salesforcedx-vscode-services'
  );

  if (!sfServices?.exports) {
    throw new Error('Salesforce Services extension not available');
  }

  const { services } = sfServices.exports;

  // Now you have access to all services with full type safety
  // services.ConnectionService
  // services.ProjectService
  // services.ChannelService
  // services.WorkspaceService
  // ... and more
};
```

## What's Included

This package exports:

- **`SalesforceVSCodeServicesApi`** - The complete type definition for the extension's public API
  - Includes type definitions for all service classes
  - Provides access to service tags and implementations
  - Fully typed method signatures and return types

**All internal implementation details are protected.** The package uses Node.js `exports` field to restrict imports to only the main entry point. You cannot directly import internal types or constants.

## Package Contents

This package bundles:

- Type definitions for the public API
- Type definitions for all transitive dependencies
- Runtime `ICONS`; service exports are type-only

## Development

The public entry is generated over the frozen declarations in `legacy/services.d.ts`.
Only the release version tracks the extension; declaration dependencies remain
independent of its future V4 implementation. Run `pnpm test:packed-services` from
the repository root to verify a real packed installation with Effect V3 and no V4.

## License

BSD-3-Clause

## Support

For issues or questions, please file an issue at:
<https://github.com/forcedotcom/salesforcedx-vscode/issues>
