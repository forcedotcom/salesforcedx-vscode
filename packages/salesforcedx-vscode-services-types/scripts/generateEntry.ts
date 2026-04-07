import * as fs from 'fs';
import * as path from 'path';

/** Generates the entry point that re-exports the public API type and ICONS */
const generateEntry = (): void => {
  const srcDir = path.join(__dirname, '..', 'src');
  const entryPath = path.join(srcDir, 'index.ts');

  // Create src directory if it doesn't exist
  fs.mkdirSync(srcDir, { recursive: true });

  // Generate minimal entry point that only exports the public API
  const content = `/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This file is auto-generated. Do not edit manually.
export type { SalesforceVSCodeServicesApi } from '../../salesforcedx-vscode-services/out/src/index';
export { DefaultOrgInfoSchema } from '../../salesforcedx-vscode-services/out/src/core/schemas/defaultOrgInfo';
export { invalidateCachedConnections } from '../../salesforcedx-vscode-services/out/src/core/connectionService';
export { ICONS, type IconId } from './icons';
`;

  fs.writeFileSync(entryPath, content, 'utf8');
  console.log('Generated entry point at', entryPath);

  const iconsPath = path.join(srcDir, 'icons.ts');
  const iconsContent = `/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This file is auto-generated. Do not edit manually.
/** Well-known icon IDs for VS Code UI strings. */
export const ICONS = {
  SF_DEFAULT_ORG: '$(sf-org-leaf)',
  SF_DEFAULT_HUB: '$(sf-org-tree)',
  ORG_TYPE_DEVHUB: '$(server)',
  ORG_TYPE_SANDBOX: '$(beaker)',
  ORG_TYPE_SCRATCH: '$(zap)',
  ORG_TYPE_ORG: '$(cloud)',
  ADD: '$(plus)',
  BROWSER: '$(browser)',
  WARNING: '$(warning)'
} as const;

export type IconId = (typeof ICONS)[keyof typeof ICONS];
`;
  fs.writeFileSync(iconsPath, iconsContent, 'utf8');
  console.log('Generated icons at', iconsPath);
};

generateEntry();
