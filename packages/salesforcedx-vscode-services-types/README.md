# @salesforce/vscode-services

TypeScript type definitions for the Salesforce VS Code Services extension API.

## Overview

One package, two API endpoints:

- `@salesforce/vscode-services`: legacy V3 declarations for `api.services`; its runtime export is `ICONS`.
- `@salesforce/vscode-services/v2`: V4 keys, schemas and declarations for `api.v2.services`.

The package installs ordinary Effect V4 and the `effect-v3` alias. The root does not load V4. Neither endpoint owns another provider graph. The published root declarations expose only Connection/Alias/Config operations, the target-org ref, and prebuilt Context/Layer required by audited external consumers. The full frozen V3 snapshot remains a private transitional input.

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
  const { ConnectionService, AliasService, ConfigService } = api.services;

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
  // services.AliasService
  // services.ConfigService
  // services.TargetOrgRef
};
```

## What's Included

This package exports:

- **`SalesforceVSCodeServicesApi`** - The externally required V3 API subset, with its original identifiers and failure types.
- **`SalesforceVSCodeServicesApiV2`** at `/v2` - The V4 contracts for first-party consumers.

The package's `exports` restrict imports to the root, `/v2`, and the browser-safe `/v2/uriComparison` helper. Provider implementations remain private.

## Package Contents

This package bundles:

- Type definitions for the public API
- Type definitions for all transitive dependencies
- Root runtime `ICONS`; legacy service exports are type-only
- V4 keys/schemas and API declarations at `/v2`

## Development

The compatibility package generates and prunes the external subset from the frozen
`legacy/services.d.ts` input in its V3 scope. This package rewrites that result's
Effect imports to `effect-v3`, then validates it strictly. No private compatibility
package or V3 companion-library dependency is published. V4 contracts in `v2/` use
ordinary `effect`. Run `pnpm test:packed-services` from the repository root to verify
independently installed root/V3 and `/v2`/V4 consumers, strict declarations, negative
cross-major controls, and Node/browser bundle isolation. Registry publication waits
for the coordinated provider/consumer cutover.

## License

BSD-3-Clause

## Support

For issues or questions, please file an issue at:
<https://github.com/forcedotcom/salesforcedx-vscode/issues>
