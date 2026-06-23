/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

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
export { ICONS, type IconId } from './icons';
// Owned data types (import-free DTOs)
export type {
  MetadataTypeInfo,
  TemplateCreateOutcome,
  ConnectionData
} from '../../salesforcedx-vscode-services/out/src/owned/metadata';
export type {
  ComponentSetInfo,
  ComponentInfo
} from '../../salesforcedx-vscode-services/out/src/owned/components';
export type {
  DeployOutcome,
  RetrieveOutcome,
  FileResponseInfo,
  ComponentFailureInfo,
  SourceSpec,
  DeployFromSourceOptions,
  RetrieveOptions
} from '../../salesforcedx-vscode-services/out/src/owned/deploy';
export type { OrgChange } from '../../salesforcedx-vscode-services/out/src/owned/changes';
export type { ProjectInfo, PackageDirInfo } from '../../salesforcedx-vscode-services/out/src/owned/projectInfo';
export { toDeployOutcome, toRetrieveOutcome } from '../../salesforcedx-vscode-services/out/src/owned/deployMapper';
`;

  fs.writeFileSync(entryPath, content, 'utf8');
  console.log('Generated entry point at', entryPath);

  // The IMPORT-FREE owned-data entry (subpath: salesforcedx-vscode-services-types/owned).
  // Re-exports ONLY the owned data surface — the curated OwnedServicesApi + DTOs + helpers + ICONS.
  // It deliberately omits the full SalesforceVSCodeServicesApi (which still references SDK types via the
  // surviving deprecated getters and the effect-coupled `services` sub-object) so this surface type-checks
  // for consumers that install NEITHER the Salesforce SDK NOR effect. Guarded by publishedOwnedImportFree.test.ts.
  const ownedEntryPath = path.join(srcDir, 'owned.ts');
  const ownedContent = `/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This file is auto-generated. Do not edit manually.
// Import-free, data-only services surface. Zero imports from @salesforce/*, jsforce, effect.
export type { OwnedServicesApi, OwnedCreateParams } from '../../salesforcedx-vscode-services/out/src/owned/ownedServicesApi';
export type {
  MetadataTypeInfo,
  TemplateCreateOutcome,
  ConnectionData
} from '../../salesforcedx-vscode-services/out/src/owned/metadata';
export type {
  ComponentSetInfo,
  ComponentInfo,
  OwnedMetadataMember
} from '../../salesforcedx-vscode-services/out/src/owned/components';
export type {
  DeployOutcome,
  RetrieveOutcome,
  RetrievedComponentInfo,
  FileResponseInfo,
  ComponentFailureInfo,
  SourceSpec,
  DeployFromSourceOptions,
  RetrieveOptions
} from '../../salesforcedx-vscode-services/out/src/owned/deploy';
export type { OrgChange } from '../../salesforcedx-vscode-services/out/src/owned/changes';
export type { ProjectInfo, PackageDirInfo } from '../../salesforcedx-vscode-services/out/src/owned/projectInfo';
export type {
  ServicesOrg,
  OwnedQueryResult,
  OwnedSaveResult,
  OwnedHttpRequest,
  OwnedIdentityInfo,
  QueryOpts,
  ToolingOpt
} from '../../salesforcedx-vscode-services/out/src/owned/servicesOrg';
export {
  componentSetHas,
  componentFilenamesByNameAndType
} from '../../salesforcedx-vscode-services/out/src/owned/componentSetInfoHelpers';
export { ICONS, type IconId } from './icons';
`;
  fs.writeFileSync(ownedEntryPath, ownedContent, 'utf8');
  console.log('Generated owned entry point at', ownedEntryPath);

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
