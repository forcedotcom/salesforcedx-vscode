/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { AllServicesLayer } from './extensionProvider';

export const listSObjectNamesEffect = Effect.gen(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.MetadataDescribeService.listSObjects().pipe(
    Effect.map(sobjects => sobjects.filter(s => s.queryable).map(s => s.name))
  );
}).pipe(
  Effect.provide(AllServicesLayer),
  Effect.catchAll(() => Effect.succeed<string[]>([]))
);
