/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { DeployResult } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';

/** Format deploy results for output */
export const formatDeployOutput = Effect.fn('formatDeployOutput')(function* (result: DeployResult) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const componentSetService = yield* api.services.ComponentSetService;
  const fileResponses = result.getFileResponses();
  const succeeded = fileResponses.filter(componentSetService.isSDRSuccess);
  const failed = fileResponses.filter(componentSetService.isSDRFailure);

  const successSection =
    succeeded.length > 0
      ? `\n=== Deployed Source ===\n${succeeded.map(r => `${r.state} ${r.type} ${r.fullName}`).join('\n')}\n`
      : '';

  const failureSection =
    failed.length > 0
      ? `\n=== Deploy Errors ===\n${failed
          .map(r => {
            const error = 'error' in r ? r.error : 'Unknown error';
            return `ERROR: ${r.filePath ?? r.fullName}: ${error}`;
          })
          .join('\n')}\n`
      : '';

  const summary = `\n${succeeded.length} component${succeeded.length === 1 ? '' : 's'} deployed${failed.length > 0 ? `, ${failed.length} failed` : ''}\n`;

  return successSection + failureSection + summary;
});
