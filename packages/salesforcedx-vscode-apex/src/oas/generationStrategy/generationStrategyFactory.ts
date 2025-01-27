/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ApexClassOASEligibleResponse, ApexClassOASGatherContextResponse } from '../schemas';
import { MethodByMethodStrategy } from './methodByMethodStrategy';
import { WholeClassStrategy } from './wholeClassStrategy';
export enum GenerationStrategy {
  WHOLE_CLASS = 'WholeClass',
  METHOD_BY_METHOD = 'MethodByMethod'
}

export type Strategy = WholeClassStrategy | MethodByMethodStrategy;

export class GenerationStrategyFactory {
  public static initializeAllStrategies(
    metadata: ApexClassOASEligibleResponse,
    context: ApexClassOASGatherContextResponse
  ): Map<GenerationStrategy, Strategy> {
    const strategies = new Map<GenerationStrategy, Strategy>();
    strategies.set(GenerationStrategy.WHOLE_CLASS, new WholeClassStrategy(metadata, context));
    strategies.set(GenerationStrategy.METHOD_BY_METHOD, new MethodByMethodStrategy(metadata, context));
    return strategies;
  }
}
