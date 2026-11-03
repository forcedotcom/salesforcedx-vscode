/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgMetadataCatalogService } from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';

const metadataTypesToPreload = ['ApexClass'] as const;

/** Loads the configured metadata inventories used by Org Browser discovery. */
export const preloadMetadataTypes = (catalog: OrgMetadataCatalogService) =>
  Effect.forEach(metadataTypesToPreload, type => catalog.getChildren({ type }), { concurrency: 5, discard: true });
