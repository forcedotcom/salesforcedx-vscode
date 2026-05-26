/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ApexClassOASGatherContextResponse } from '../../schemas';
import type { GenerationStrategy, StrategyTelemetry } from '../generationStrategy';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { OasGenerationFailed } from '../../../errors';
import { hasAuraFrameworkCapability } from '../../../oasUtils';
import { IMPOSED_FACTOR, SUM_TOKEN_MAX_LIMIT } from '../constants';

const STRATEGY_NAME = 'AuraEnabled';
const BETA_INFO = 'OpenAPI documents generated from Apex classes using @AuraEnabled annotations are in beta.';

export const createAuraEnabledStrategy = async (
  context: ApexClassOASGatherContextResponse
): Promise<GenerationStrategy> => {
  // eslint-disable-next-line functional/no-let
  let oasSchema = '';

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
      const connection = yield* api.services.ConnectionService.getConnection();
      const endpoint = `/specifications/oas3/apex/${context.classDetail.name}`;
      const result = yield* Effect.tryPromise({
        try: () => connection.request({ method: 'GET', url: endpoint }),
        catch: cause =>
          new OasGenerationFailed({ message: `Failed to fetch OAS specification from org: ${String(cause)}` })
      });
      oasSchema = JSON.stringify(result);
      return oasSchema;
    },
    Effect.catchAll(cause =>
      cause instanceof OasGenerationFailed
        ? Effect.fail(cause)
        : Effect.fail(
            new OasGenerationFailed({ message: `Failed to fetch OAS specification from org: ${String(cause)}` })
          )
    )
  );

  const getTelemetry = (): StrategyTelemetry => ({
    strategyName: STRATEGY_NAME,
    biddedCallCount: 0,
    llmCallCount: 0,
    generationSize: 0
  });

  return {
    strategyName: STRATEGY_NAME,
    betaInfo: BETA_INFO,
    get openAPISchema() {
      return oasSchema;
    },
    bid,
    generateOAS,
    getTelemetry
  };
};
