/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgMetadataPresence } from './orgMetadataCatalogTypes';
import type { OrgMetadataComponentReference } from './orgMetadataReference';

export const emptyPresence = (): OrgMetadataPresence => ({ inOrg: false, inWorkspace: false });

/** Identity key for a metadata component reference, independent of the org it was observed in. */
export const componentIdentity = (reference: OrgMetadataComponentReference): string =>
  `${reference.xmlName}\0${reference.fullName}`;
export const typeCacheKey = (orgId: string, xmlName: string): string => `${orgId}\0${xmlName}`;
export const sobjectDescriptionKey = (orgId: string, apiName: string): string => `${orgId}\0${apiName}`;

export const metadataListingKey = (orgId: string, xmlName: string, folder?: string): string =>
  `${orgId}\0${xmlName}\0${folder ?? ''}`;
