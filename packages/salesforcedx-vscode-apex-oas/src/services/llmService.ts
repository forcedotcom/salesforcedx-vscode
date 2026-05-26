/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type LLMServiceInterface, ServiceProvider, ServiceType } from '@salesforce/vscode-service-provider';
import * as Effect from 'effect/Effect';
import { LLMCallFailed } from '../errors';

const EXTENSION_ID = 'salesforcedx-vscode-apex-oas';

export class LLMService extends Effect.Service<LLMService>()('LLMService', {
  accessors: true,
  effect: Effect.gen(function* () {
    const getInterface = Effect.tryPromise({
      try: async (): Promise<LLMServiceInterface> => ServiceProvider.getService(ServiceType.LLMService, EXTENSION_ID),
      catch: cause => new LLMCallFailed({ message: `Failed to obtain LLMService: ${String(cause)}`, cause })
    });

    const callLLM = Effect.fn('ApexOas.Llm.callLLM')(function* (
      prompt: string,
      promptId: string | undefined,
      tokenLimit: number | undefined
    ) {
      const llm = yield* getInterface;
      return yield* Effect.tryPromise({
        try: () => llm.callLLM(prompt, promptId, tokenLimit),
        catch: cause => new LLMCallFailed({ message: `LLM call failed: ${String(cause)}`, cause })
      });
    });

    return { callLLM };
  })
}) {}
