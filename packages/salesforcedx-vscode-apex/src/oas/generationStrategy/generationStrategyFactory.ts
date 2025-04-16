/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ApexClassOASEligibleResponse, ApexClassOASGatherContextResponse } from '../schemas';
import { JsonMethodByMethodStrategy } from './json/jsonMethodByMethod';
export enum GenerationStrategy {
  JSON_METHOD_BY_METHOD = 'JsonMethodByMethod'
}

export type Strategy = JsonMethodByMethodStrategy;

export class GenerationStrategyFactory {
  public static initializeAllStrategies(
    metadata: ApexClassOASEligibleResponse,
    context: ApexClassOASGatherContextResponse
  ): Map<GenerationStrategy, Strategy> {
    const strategies = new Map<GenerationStrategy, Strategy>();
    strategies.set(GenerationStrategy.JSON_METHOD_BY_METHOD, new JsonMethodByMethodStrategy(metadata, context));
    return strategies;
  }
}
