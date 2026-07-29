/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { FileChangeEvent } from '../vscode/fileChangePubSub';
import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';

export type OrgMetadataCatalogChange =
  | {
      readonly kind: 'workspace';
      readonly event: FileChangeEvent;
    }
  | {
      readonly kind: 'org';
      readonly orgId: string | undefined;
    };

/** Signals why consumers should re-query their view of the org catalog. */
export class OrgMetadataCatalogChangePubSub extends Effect.Service<OrgMetadataCatalogChangePubSub>()(
  'OrgMetadataCatalogChangePubSub',
  {
    scoped: PubSub.sliding<OrgMetadataCatalogChange>(100)
  }
) {}
