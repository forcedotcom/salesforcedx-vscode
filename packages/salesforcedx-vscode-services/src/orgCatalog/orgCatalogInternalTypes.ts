/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { PersistedTypeInventory } from './orgMetadataCatalogStore';
import type { OrgMetadataCatalogEntry } from './orgMetadataCatalogTypes';
import type { OrgMetadataComponentReference } from './orgMetadataReference';

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
  readonly components: ReadonlyMap<string, OrgMetadataCatalogEntry>;
  readonly folders: ReadonlyMap<string, ListedMetadataComponent>;
};

export type InventoryCache = ReadonlyMap<string, TypeInventory>;
export type PersistedInventoryCache = ReadonlyMap<string, PersistedTypeInventory>;

export type RemoteTrackingObservation = {
  readonly reference: OrgMetadataComponentReference;
  readonly signature: string;
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
