/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ProcessorInputOutput } from './processorStep';
import * as Effect from 'effect/Effect';
import type { OpenAPIV3 } from 'openapi-types';

type ExtendedInfoObject = OpenAPIV3.InfoObject & {
  [key: `x-${string}`]: string;
};

export const betaInfoInjectionStep = (betaInfo: string | undefined) =>
  Effect.fn('ApexOas.Process.betaInfoInjection')(function* (input: ProcessorInputOutput) {
    const info = input.openAPIDoc.info ?? {};
    const updatedInfo: ExtendedInfoObject = { ...info, ...(betaInfo ? { 'x-betaInfo': betaInfo } : {}) };
    return { ...input, openAPIDoc: { ...input.openAPIDoc, info: updatedInfo } };
  });
