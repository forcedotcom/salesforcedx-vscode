/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ApexClassOASEligibleResponse, ApexClassOASGatherContextResponse } from '../schemas';
import * as Effect from 'effect/Effect';
import type { OpenAPIV3 } from 'openapi-types';
import { betaInfoInjectionStep } from './betaInfoInjectionStep';
import { methodValidationStep } from './methodValidationStep';
import { oasReorderStep } from './oasReorderStep';
import { oasValidationStep } from './oasValidationStep';
import { propertyCorrectionStep } from './propertyCorrectionStep';
import { reconcileDuplicateSemanticPathsStep } from './reconcileDuplicateSemanticPathsStep';

type ProcessOasDocumentOptions = {
  context?: ApexClassOASGatherContextResponse;
  eligibleResult?: ApexClassOASEligibleResponse;
  isRevalidation?: boolean;
  betaInfo?: string;
};

export const processOasDocument = Effect.fn('ApexOas.Process.run')(function* (
  document: OpenAPIV3.Document,
  options?: ProcessOasDocumentOptions
) {
  return yield* Effect.succeed({
    openAPIDoc: document,
    errors: [],
    eligibilityResult: options?.eligibleResult,
    context: options?.context
  }).pipe(
    Effect.tap(() => Effect.logDebug({ event: 'pipelineInput', document })),
    Effect.flatMap(io => (options?.isRevalidation === true ? Effect.succeed(io) : propertyCorrectionStep(io))),
    Effect.flatMap(io =>
      options?.isRevalidation === true ? Effect.succeed(io) : betaInfoInjectionStep(options?.betaInfo)(io)
    ),
    Effect.flatMap(reconcileDuplicateSemanticPathsStep),
    Effect.flatMap(methodValidationStep),
    Effect.flatMap(oasValidationStep),
    Effect.flatMap(oasReorderStep),
    Effect.tap(output => Effect.logDebug({ event: 'pipelineOutput', output }))
  );
});
