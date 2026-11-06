/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OasClassContext } from '../../apexSourceMetadata';
import { ExtensionProviderService, annotateRootSpan } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { OasGenerationFailed } from '../../../errors';

export const generateAuraEnabledOas = Effect.fn('ApexOas.AuraEnabled.generateOAS')(
  function* (classContext: OasClassContext) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const connection = yield* api.services.ConnectionService.getConnection();
    const endpoint = `/specifications/oas3/apex/${classContext.name}`;
    const result = yield* Effect.tryPromise({
      try: () => connection.request({ method: 'GET', url: endpoint }),
      catch: cause =>
        new OasGenerationFailed({ message: `Failed to fetch OAS specification from org: ${String(cause)}` })
    });
    return JSON.stringify(result);
  },
  Effect.tap(() =>
    annotateRootSpan({ strategyName: 'AuraEnabled', biddedCallCount: 0, llmCallCount: 0, generationSize: 0 })
  ),
  Effect.catchAll(cause =>
    Schema.is(OasGenerationFailed)(cause)
      ? Effect.fail(cause)
      : Effect.fail(
          new OasGenerationFailed({ message: `Failed to fetch OAS specification from org: ${String(cause)}` })
        )
  )
);
