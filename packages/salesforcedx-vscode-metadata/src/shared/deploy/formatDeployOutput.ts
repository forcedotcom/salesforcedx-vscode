/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { DeployOutcome, FileResponseInfo } from 'salesforcedx-vscode-services';
import { URI } from 'vscode-uri';
import { getMergedDeployFailures } from './getMergedDeployFailures';

/** Matches {@link ComponentSetService.getComponentState}; avoids importing from services in this package. */
type ComponentChangeKind = 'created' | 'changed' | 'unchanged' | 'deleted';

/** Map SDR file state to our change classification. Lowercase the state; default 'changed'. */
const stateToChange = (state: string): ComponentChangeKind => {
  const lower = state.toLowerCase();
  if (lower === 'created' || lower === 'changed' || lower === 'unchanged' || lower === 'deleted') {
    return lower;
  }
  return 'changed';
};

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

const formatDeployedLines = (responses: readonly FileResponseInfo[]) =>
  responses.map(r => `${r.state} ${r.type} ${r.filePath ? URI.file(r.filePath).toString() : r.fullName}`).join('\n');

const formatNotDeployedLines = (responses: readonly FileResponseInfo[]) =>
  responses
    .map(r => {
      const path = r.filePath ? URI.file(r.filePath).toString() : r.fullName;
      const label = notDeployedOutcomeLabel(stateToChange(r.state));
      return `${label} — ${r.type} ${path}`;
    })
    .join('\n');

/** Format deploy outcome for channel output (operates on owned types; pure function). */
export const formatDeployOutput = (outcome: DeployOutcome): string => {
  const failed = getMergedDeployFailures(outcome);
  const applied = outcome.appliedToOrg;

  const successResponses = outcome.fileResponses.filter(fr => fr.state !== 'Failed');
  const { deploys = [], deleted = [] } = Object.groupBy(successResponses, fr =>
    fr.state === 'Deleted' ? 'deleted' : 'deploys'
  );

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
            const error = r.error ?? 'Unknown error';
            return `ERROR: ${r.filePath ?? r.fullName}: ${error}`;
          })
          .join('\n')}\n`
      : '';

  return successSection + deletedSection + failureSection;
};
