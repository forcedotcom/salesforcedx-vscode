/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';

export const listSObjectNamesEffect = ExtensionProviderService.pipe(
  Effect.flatMap(provider => provider.getServicesApi),
  Effect.flatMap(api => api.services.MetadataDescribeService),
  Effect.flatMap(metadataDescribe => metadataDescribe.listSObjects()),
  Effect.map(sobjects => sobjects.filter(s => s.queryable).map(s => s.name)),
  Effect.catchAll(() => Effect.succeed<string[]>([]))
);
