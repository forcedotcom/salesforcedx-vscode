/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { GenerationStrategy } from '../generationStrategy';
import { ExtensionProviderService, annotateRootSpan } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import type { ApexClassOASGatherContextResponse } from 'salesforcedx-vscode-apex';
import { OasGenerationFailed } from '../../../errors';
import { hasAuraFrameworkCapability } from '../../../oasUtils';
import { IMPOSED_FACTOR, SUM_TOKEN_MAX_LIMIT } from '../constants';

export const createAuraEnabledStrategy = async (
  context: ApexClassOASGatherContextResponse
): Promise<GenerationStrategy> => {
  const bid = () => {
    const shouldBid = hasAuraFrameworkCapability(context);
    return Effect.succeed({
      result: {
        maxBudget: shouldBid ? SUM_TOKEN_MAX_LIMIT * IMPOSED_FACTOR : 0,
        callCounts: shouldBid ? 1 : 0
      }
    });
  };

  const generateOAS = Effect.fn('ApexOas.AuraEnabled.generateOAS')(
    function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const endpoint = `/specifications/oas3/apex/${context.classDetail.name}`;
      const result = yield* Effect.tryPromise({
        try: () => api.withDefaultOrg(org => org.request({ method: 'GET', url: endpoint })),
        catch: cause =>
          new OasGenerationFailed({ message: `Failed to fetch OAS specification from org: ${String(cause)}` })
      });
      return JSON.stringify(result);
    },
    Effect.tap(() =>
      annotateRootSpan({ strategyName: 'AuraEnabled', biddedCallCount: 0, llmCallCount: 0, generationSize: 0 })
    ),
    Effect.catchAll(cause =>
      cause instanceof OasGenerationFailed
        ? Effect.fail(cause)
        : Effect.fail(
            new OasGenerationFailed({ message: `Failed to fetch OAS specification from org: ${String(cause)}` })
          )
    )
  );

  return {
    bid,
    generateOAS
  };
};
