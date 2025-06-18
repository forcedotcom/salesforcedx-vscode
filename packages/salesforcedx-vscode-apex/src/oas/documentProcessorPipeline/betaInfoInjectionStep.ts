/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OpenAPIV3 } from 'openapi-types';
import { ProcessorInputOutput, ProcessorStep } from './processorStep';

type ExtendedInfoObject = OpenAPIV3.InfoObject & {
  [key: `x-${string}`]: string;
};

export class BetaInfoInjectionStep implements ProcessorStep {
  private betaInfo: string | undefined;

  constructor(betaInfo: string | undefined) {
    this.betaInfo = betaInfo;
  }

  process(input: ProcessorInputOutput): Promise<ProcessorInputOutput> {
    const modifiedOASDoc = this.injectBetaInfo(input.openAPIDoc);

    return new Promise(resolve => {
      resolve({ ...input, openAPIDoc: modifiedOASDoc });
    });
  }

  private injectBetaInfo(oasDoc: OpenAPIV3.Document<{}>): OpenAPIV3.Document<{}> {
    const info = oasDoc.info || {};
    const updatedInfo: ExtendedInfoObject = { ...info };

    if (this.betaInfo) {
      updatedInfo['x-betaInfo'] = this.betaInfo;
    }

    return {
      ...oasDoc,
      info: updatedInfo
    };
  }
}
