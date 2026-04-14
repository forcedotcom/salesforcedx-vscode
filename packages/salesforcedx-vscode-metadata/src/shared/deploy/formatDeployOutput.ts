/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { DeployResult } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { getMergedDeployFailures } from './getMergedDeployFailures';

/** True when the org applied at least part of the deploy (full or partial success). */
const deployAppliedToOrg = (result: DeployResult): boolean => {
  const status = result.response?.status;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- `RequestStatus` is a string enum; compare to known success values without importing the enum here
  return status === 'Succeeded' || status === 'SucceededPartial';
};

/** Matches {@link ComponentSetService.getComponentState}; avoids importing from services in this package. */
type ComponentChangeKind = 'created' | 'changed' | 'unchanged' | 'deleted';

/** When the deploy did not apply, avoid API labels like "Created" that imply the org was updated. */
const notDeployedOutcomeLabel = (change: ComponentChangeKind): string => {
  switch (change) {
    case 'created':
      return 'Would have been created';
    case 'changed':
      return 'Would have been updated';
    case 'unchanged':
      return 'Would have had no changes';
    case 'deleted':
      return 'Would have been deleted';
  }
};

/** Format deploy results for output */
export const formatDeployOutput = Effect.fn('formatDeployOutput')(function* (result: DeployResult) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { isSDRSuccess, getComponentState } = yield* api.services.ComponentSetService;
  const failed = yield* getMergedDeployFailures(result);
  const applied = deployAppliedToOrg(result);

  const { deploys = [], deleted = [] } = Object.groupBy(result.getFileResponses().filter(isSDRSuccess), fr =>
    getComponentState(fr) === 'deleted' ? 'deleted' : 'deploys'
  );

  const formatDeployedLines = (responses: typeof deploys) =>
    responses.map(r => `${r.state} ${r.type} ${URI.file(r.filePath).toString()}`).join('\n');

  const formatNotDeployedLines = (responses: typeof deploys) =>
    responses
      .map(r => {
        const path = URI.file(r.filePath).toString();
        const label = notDeployedOutcomeLabel(getComponentState(r));
        return `${label} — ${r.type} ${path}`;
      })
      .join('\n');

  const successSection =
    deploys.length > 0
      ? applied
        ? `\n=== Deployed Source (${deploys.length}) ===\n${formatDeployedLines(deploys)}\n`
        : `\n=== Components without file-level errors (${deploys.length}) — not deployed ===\n` +
          'The deploy did not complete successfully, so no metadata changes were applied to the org. ' +
          `The following had no file-level errors but were not deployed:\n${formatNotDeployedLines(deploys)}\n`
      : '';

  const deletedSection =
    deleted.length > 0
      ? applied
        ? `\n=== Deleted Source (${deleted.length}) ===\n${formatDeployedLines(deleted)}\n`
        : `\n=== Deletes without file-level errors (${deleted.length}) — not applied ===\n` +
          'The deploy did not complete successfully, so no metadata changes were applied to the org. ' +
          `The following deletes had no file-level errors but were not applied:\n${formatNotDeployedLines(deleted)}\n`
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
