/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import type { OrgMetadataCatalog } from 'salesforcedx-vscode-services';

const metadataTypesToPreload = ['ApexClass'] as const;

/** Loads the configured metadata inventories used by Org Browser discovery. */
export const preloadMetadataTypes = (catalog: OrgMetadataCatalog) =>
  Effect.forEach(metadataTypesToPreload, type => catalog.getChildren({ type }), { concurrency: 5, discard: true });
