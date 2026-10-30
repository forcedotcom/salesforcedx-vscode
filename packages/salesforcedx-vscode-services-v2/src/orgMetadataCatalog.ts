/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ConnectionError } from './connectionService.js';
import type { InactiveOrgOperationError, GetRegistryAccessError } from './errors.js';
import type { MetadataDescribeReadError, MetadataListReadError } from './metadataDescribeService.js';
import type { OrgMetadataCatalogError } from './orgMetadataCatalogErrors.js';
import type {
  OrgMetadataCatalogComponentReference,
  OrgMetadataCatalogEntry,
  OrgMetadataCatalogReference,
  OrgMetadataConsistency,
  OrgMetadataHierarchyConsistency
} from './orgMetadataCatalogTypes.js';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type * as vscode from 'vscode';
import type { URI } from 'vscode-uri';

export type OrgMetadataCatalogReadError =
  | ConnectionError
  | InactiveOrgOperationError
  | GetRegistryAccessError
  | MetadataDescribeReadError
  | MetadataListReadError
  | OrgMetadataCatalogError
  | vscode.FileSystemError;
export type OrgMetadataCatalogComponentResolution = {
  readonly reference: OrgMetadataCatalogComponentReference;
  readonly presence: 'both' | 'org';
  readonly workspacePresenceAvailable: boolean;
  readonly preferredUri: URI;
  readonly orgUri: URI;
  readonly workspaceUri?: URI;
};
export class OrgMetadataCatalog extends Context.Service<
  OrgMetadataCatalog,
  {
    readonly getChildren: (
      reference?: OrgMetadataCatalogReference,
      options?: { readonly consistency?: OrgMetadataHierarchyConsistency }
    ) => Effect.Effect<readonly OrgMetadataCatalogEntry[], OrgMetadataCatalogReadError>;
    readonly getEntries: (
      references: readonly OrgMetadataCatalogComponentReference[],
      options?: { readonly consistency?: OrgMetadataConsistency }
    ) => Effect.Effect<readonly (OrgMetadataCatalogEntry | undefined)[], OrgMetadataCatalogReadError>;
    readonly hasTypeInventory: (type: string) => Effect.Effect<boolean, ConnectionError | InactiveOrgOperationError>;
    readonly resolveComponents: (
      references: readonly OrgMetadataCatalogComponentReference[]
    ) => Effect.Effect<
      readonly OrgMetadataCatalogComponentResolution[],
      ConnectionError | InactiveOrgOperationError | GetRegistryAccessError
    >;
  }
>()('@salesforce/vscode-services-v2/OrgMetadataCatalog') {}
