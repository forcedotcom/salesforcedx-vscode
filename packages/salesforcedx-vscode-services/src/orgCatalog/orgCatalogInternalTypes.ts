/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { PersistedTypeInventory } from './orgMetadataCatalogStore';
import type { OrgMetadataCatalogInternalEntry as OrgMetadataCatalogEntry } from './orgMetadataCatalogTypes';
import type { OrgMetadataComponentReference } from './orgMetadataReference';
import type * as HashMap from 'effect/HashMap';

export type ListedMetadataComponent = {
  readonly fullName: string;
  readonly namespacePrefix?: string;
  readonly manageableState?: string;
  readonly fileName?: string;
  readonly lastModifiedByName?: string;
  readonly lastModifiedDate?: string;
};

export type TypeInventory = {
  readonly observedAt: string;
  /** Whether this inventory represents a complete type listing rather than consumer-discovered members. */
  readonly complete: boolean;
  readonly components: HashMap.HashMap<string, OrgMetadataCatalogEntry>;
  readonly componentIdentityOrder: readonly string[];
  readonly folders: HashMap.HashMap<string, ListedMetadataComponent>;
  readonly folderFullNameOrder: readonly string[];
};

export type InventoryCache = HashMap.HashMap<string, TypeInventory>;
export type PersistedInventoryCache = HashMap.HashMap<string, PersistedTypeInventory>;

export type RemoteTrackingObservation = {
  readonly reference: OrgMetadataComponentReference;
  readonly signature: string;
};

export type RemoteTrackingObservations = {
  readonly byIdentity: HashMap.HashMap<string, RemoteTrackingObservation>;
  readonly identityOrder: readonly string[];
};

export type MetadataTypeObservation = {
  readonly xmlName: string;
  readonly directoryName: string;
  readonly suffix?: string;
  readonly folderContentType?: string;
  readonly inFolder: boolean;
  readonly metaFile: boolean;
  readonly childXmlNames: readonly string[];
  readonly observedAt: string;
};

export type MetadataListingObservation = {
  readonly xmlName: string;
  readonly folder?: string;
  readonly observedAt: string;
  readonly components: readonly ListedMetadataComponent[];
};
