# @salesforce/vscode-services

TypeScript type definitions for the Salesforce VS Code Services extension API.

## Overview

This package provides TypeScript type definitions for consuming the Salesforce VS Code Services extension API. It contains only type declarations (`.d.ts` files) with no runtime code, making it lightweight and suitable for type-checking during development.

## Installation

```bash
npm install --save-dev @salesforce/vscode-services
```

## Usage

Import the type definitions in your VS Code extension to get type safety when consuming the Salesforce Services API:

```typescript
import type { SalesforceVSCodeServicesApi } from '@salesforce/vscode-services';
import * as vscode from 'vscode';

const ext = vscode.extensions.getExtension<SalesforceVSCodeServicesApi>(
  'salesforce.salesforcedx-vscode-services'
);
const api = ext?.exports;

if (api) {
  // Promise-based — no Effect dependency needed
  const connection = await api.getConnection();
  const orgInfo = await api.getTargetOrgInfo();
  const project = await api.getSfProject();
}
```

### Plain API (Recommended)

The API exposes Promise-based methods directly on the exports object. No framework dependencies required:

```typescript
import type { SalesforceVSCodeServicesApi, DefaultOrgInfo } from '@salesforce/vscode-services';
import * as vscode from 'vscode';

export const activate = async (context: vscode.ExtensionContext) => {
  const ext = vscode.extensions.getExtension<SalesforceVSCodeServicesApi>(
    'salesforce.salesforcedx-vscode-services'
  );
  if (!ext?.exports) throw new Error('Salesforce Services extension not available');
  const api = ext.exports;

  // Org auth
  const conn = await api.getConnection();
  const orgInfo = await api.getTargetOrgInfo();

  // React to org changes
  const disposable = api.onDidChangeTargetOrg((info: DefaultOrgInfo) => {
    console.log('Target org changed:', info.username);
  });
  context.subscriptions.push(disposable);

  // Workspace & project
  const isSf = await api.isSalesforceProject();
  const workspace = await api.getWorkspaceInfo();

  // Settings, config, aliases
  const apiVersion = await api.getApiVersion();
  const devHub = await api.getTargetDevHub();
  const aliases = await api.getAllAliases();

  // File system
  const content = await api.readFile('/path/to/file');
  const files = await api.findFiles('**/*.cls');

  // Metadata operations
  const types = await api.describe();
  const items = await api.listMetadata('ApexClass');

  // Source tracking
  const hasTracking = await api.hasTracking();
  const conflicts = await api.getConflicts();
};
```

### Effect-based API (Advanced)

For extensions using Effect-TS, the full `services` property is also available:

```typescript
const { services } = ext.exports;
// services.ConnectionService, services.ProjectService, services.TargetOrgRef, etc.
// Requires `effect` as a dependency
```

## What's Included

This package exports:

- **`SalesforceVSCodeServicesApi`** — The complete type definition for the extension's public API
- **`PlainServicesApi`** — The Promise-based facade type (subset of `SalesforceVSCodeServicesApi`)
- **`DefaultOrgInfo`** — Plain TypeScript type for target org metadata (orgId, username, userId, etc.)
- **`WorkspaceInfo`** — Plain TypeScript type for workspace state (uri, fsPath, isEmpty, etc.)
- **`DefaultOrgInfoSchema`** — Effect Schema for org info (only needed if using Effect)
- **`ICONS` / `IconId`** — Well-known icon IDs for VS Code UI strings

**All internal implementation details are protected.** The package uses Node.js `exports` field to restrict imports to only the main entry point. You cannot directly import internal types or constants.

## Package Contents

This package bundles:

- Type definitions for the public API
- Type definitions for all transitive dependencies
- No runtime code or JavaScript files

## Development

This package is automatically generated from the source code of the `salesforcedx-vscode-services` extension. Types and dependency versions are kept in sync with the parent package.

## License

BSD-3-Clause

## Support

For issues or questions, please file an issue at:
<https://github.com/forcedotcom/salesforcedx-vscode/issues>
