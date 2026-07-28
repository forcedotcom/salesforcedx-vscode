/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';
import type { URI } from 'vscode-uri';

/** Publishes canonical org-metadata roots after presence has been invalidated. */
export class OrgMetadataChangePubSub extends Effect.Service<OrgMetadataChangePubSub>()('OrgMetadataChangePubSub', {
  scoped: PubSub.sliding<URI>(1000)
}) {}
