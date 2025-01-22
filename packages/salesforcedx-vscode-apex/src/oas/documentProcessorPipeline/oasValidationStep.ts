/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Spectral } from '@stoplight/spectral-core';
import { ProcessorStep } from './processorStep';
import ruleset from './ruleset.spectral';

export class OasValidationStep implements ProcessorStep {
  async process(input: string): Promise<string> {
    const spectral = new Spectral();

    spectral.setRuleset(ruleset);

    // we lint our document using the ruleset
    await spectral.run(input).then(result => {
      // the validation should be shown in problems tab, this will be covered by W-17656525
      console.log('spectral results:', JSON.stringify(result));
    });

    // Since this step doesn't perform convertions we return the input for future processing
    return input;
  }
}
