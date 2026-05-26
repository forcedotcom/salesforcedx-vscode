/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import { hasAuraFrameworkCapability } from '../../../oasUtils';
import { getRuntime } from '../../../services/runtime';
import { ApexClassOASGatherContextResponse, PromptGenerationStrategyBid } from '../../schemas';
import { IMPOSED_FACTOR, SUM_TOKEN_MAX_LIMIT } from '../constants';
import { GenerationStrategy, StrategyTelemetry } from '../generationStrategy';

const MIN_ORG_VERSION = 65.0;
const STRATEGY_NAME = 'AuraEnabled';
const BETA_INFO = 'OpenAPI documents generated from Apex classes using @AuraEnabled annotations are in beta.';

const getConnection = () =>
  getRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      return yield* api.services.ConnectionService.getConnection();
    })
  );

export const createAuraEnabledStrategy = async (
  context: ApexClassOASGatherContextResponse
): Promise<GenerationStrategy> => {
  let oasSchema = '';
  let isDefaultOrg = false;
  let isOrgVersionCompatible = false;

  const checkOrgVersion = async (): Promise<void> => {
    try {
      const targetOrg = await ConfigUtil.getTargetOrgOrAlias();
      isDefaultOrg = targetOrg !== undefined;
      if (isDefaultOrg) {
        const connection = await getConnection();
        const numericVersion = parseFloat(connection.getApiVersion());
        isOrgVersionCompatible = numericVersion >= MIN_ORG_VERSION;
      }
    } catch (err) {
      console.error('Failed to initialize org checks:', err);
      isDefaultOrg = false;
      isOrgVersionCompatible = false;
    }
  };

  const bid = async (): Promise<PromptGenerationStrategyBid> => {
    // Initialize org checks
    await checkOrgVersion();

    // Check if any method has @AuraEnabled annotation
    const hasAuraEnabled = hasAuraFrameworkCapability(context);

    // Only bid if we have Aura-enabled methods AND we're in the default org AND the org version is compatible
    const shouldBid = hasAuraEnabled && isDefaultOrg && isOrgVersionCompatible;
    return {
      result: {
        maxBudget: shouldBid ? SUM_TOKEN_MAX_LIMIT * IMPOSED_FACTOR : 0,
        callCounts: shouldBid ? 1 : 0
      }
    };
  };

  const generateOAS = async (): Promise<string> => {
    const responses: string[] = [];
    const connection = await getConnection();
    const apiVersion = connection.getApiVersion();
    const endpoint = `${connection.instanceUrl}/services/data/v${apiVersion}/specifications/oas3/apex/${context.classDetail.name}`;

    try {
      const result = await connection.request({ method: 'GET', url: endpoint });
      responses.push(JSON.stringify(result));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch OAS specification from org: ${errorMessage}`);
    }
    oasSchema = responses.join('\n');
    return oasSchema;
  };

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
