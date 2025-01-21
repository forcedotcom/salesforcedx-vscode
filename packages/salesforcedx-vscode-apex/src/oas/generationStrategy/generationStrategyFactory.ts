/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ApexClassOASEligibleResponse, ApexClassOASGatherContextResponse } from '../../openApiUtilities/schemas';
import { MethodByMethodStrategy } from './methodByMethodStrategy';
import { WholeClassStrategy } from './wholeClassStrategy';
enum GenerationStrategy {
  WHOLE_CLASS = 'WholeClass',
  METHOD_BY_METHOD = 'MethodByMethod'
}

type Strategy = WholeClassStrategy | MethodByMethodStrategy;

export class GenerationStrategyFactory {
  public static initializeAllStrategies(
    metadata: ApexClassOASEligibleResponse,
    context: ApexClassOASGatherContextResponse
  ): Strategy[] {
    return [new WholeClassStrategy(metadata, context), new MethodByMethodStrategy(metadata, context)];
  }
}
