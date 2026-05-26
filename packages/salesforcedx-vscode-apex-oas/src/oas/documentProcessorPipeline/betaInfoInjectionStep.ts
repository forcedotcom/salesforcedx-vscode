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

export const createBetaInfoInjectionStep = (betaInfo: string | undefined): ProcessorStep => ({
  process: (input: ProcessorInputOutput): Promise<ProcessorInputOutput> => {
    const info = input.openAPIDoc.info || {};
    const updatedInfo: ExtendedInfoObject = { ...info };

    if (betaInfo) {
      updatedInfo['x-betaInfo'] = betaInfo;
    }

    return Promise.resolve({
      ...input,
      openAPIDoc: { ...input.openAPIDoc, info: updatedInfo }
    });
  }
});
