/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { OrgId } from './defaultOrgInfo.js';
import type { FileChangeEvent } from './fileChangePubSub.js';
import type { MetadataOperationEvent } from './metadataChangeNotificationService.js';
import type { OrgMetadataComponentReference } from './orgMetadataReference.js';
import * as Context from 'effect/Context';
import type * as PubSub from 'effect/PubSub';

export type OrgMetadataCatalogChange =
  | { readonly kind: 'workspace'; readonly events: readonly FileChangeEvent[] }
  | { readonly kind: 'org'; readonly orgId: OrgId | undefined }
  | { readonly kind: 'operation'; readonly event: MetadataOperationEvent }
  | { readonly kind: 'tracking'; readonly orgId: OrgId; readonly references: readonly OrgMetadataComponentReference[] };
export class OrgMetadataCatalogChangePubSub extends Context.Service<
  OrgMetadataCatalogChangePubSub,
  PubSub.PubSub<OrgMetadataCatalogChange>
>()('@salesforce/vscode-services-v2/OrgMetadataCatalogChangePubSub') {}
