/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { type DeployResult, RequestStatus } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { getMergedDeployFailures } from './getMergedDeployFailures';

/** Format deploy results for output */
export const formatDeployOutput = Effect.fn('formatDeployOutput')(function* (result: DeployResult) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { isSDRSuccess, getComponentState } = yield* api.services.ComponentSetService;
  const failed = getMergedDeployFailures(result);
  const hideSuccessSections = result.response?.status === RequestStatus.Failed;

  const { deploys = [], deleted = [] } = hideSuccessSections
    ? { deploys: [], deleted: [] }
    : Object.groupBy(result.getFileResponses().filter(isSDRSuccess), fr =>
        getComponentState(fr) === 'deleted' ? 'deleted' : 'deploys'
      );

  const successSection =
    deploys.length > 0
      ? `\n=== Deployed Source (${deploys.length}) ===\n${deploys.map(r => `${r.state} ${r.type} ${URI.file(r.filePath).toString()}`).join('\n')}\n`
      : '';

  const deletedSection =
    deleted.length > 0
      ? `\n=== Deleted Source (${deleted.length}) ===\n${deleted.map(r => `${r.state} ${r.type} ${URI.file(r.filePath).toString()}`).join('\n')}\n`
      : '';

  const failureSection =
    failed.length > 0
      ? `\n=== Deploy Errors (${failed.length}) ===\n${failed
          .map(r => {
            const error = 'error' in r ? r.error : 'Unknown error';
            return `ERROR: ${r.filePath ?? r.fullName}: ${error}`;
          })
          .join('\n')}\n`
      : '';

  return successSection + deletedSection + failureSection;
});
