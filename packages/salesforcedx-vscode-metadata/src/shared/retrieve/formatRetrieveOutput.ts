/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { FileResponse, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import { toRetrieveOutcome, type FileResponseInfo, type RetrieveOutcome } from 'salesforcedx-vscode-services';
import { URI } from 'vscode-uri';

/** Format retrieve outcome for output (operates on owned types; pure function). */
export const formatRetrieveOutput = (
  outcome: RetrieveOutcome | undefined,
  fileResponsesFromDelete: readonly FileResponseInfo[] = []
): string => {
  const fileResponses = outcome?.fileResponses ?? [];
  const succeeded = [...fileResponses.filter(fr => fr.state !== 'Failed'), ...fileResponsesFromDelete];
  const failed = fileResponses.filter(fr => fr.state === 'Failed');

  const successSection =
    succeeded.length > 0
      ? `\n=== Retrieved Source (${succeeded.length}) ===\n${succeeded.map(r => `${r.state} ${r.type} ${r.filePath ? URI.file(r.filePath).toString() : r.fullName}`).join('\n')}\n`
      : '';

  const failureSection =
    failed.length > 0
      ? `\n=== Retrieve Errors (${failed.length}) ===\n${failed
          .map(r => {
            const error = r.error ?? 'Unknown error';
            return `ERROR: ${r.filePath ?? r.fullName}: ${error}`;
          })
          .join('\n')}\n`
      : '';

  return successSection + failureSection;
};

/** TRANSITIONAL: Effect-wrapped formatter for callers still using live RetrieveResult (R5-deferred files).
 * Maps result → outcome then formats. R3 migrated retrieveComponentSet to owned; this bridges unmigrated callers. */
export const formatRetrieveOutputFromResult = Effect.fn('formatRetrieveOutput')(function* (
  result: RetrieveResult | undefined,
  fileResponsesFromDelete: FileResponse[] = []
) {
  const outcome = result ? toRetrieveOutcome(result) : undefined;
  const ownedDeleteResponses: FileResponseInfo[] = fileResponsesFromDelete.map(fr => ({
    fullName: fr.fullName,
    type: fr.type,
    state: fr.state,
    filePath: 'filePath' in fr ? fr.filePath : undefined,
    error: 'error' in fr ? fr.error : undefined
  }));
  return formatRetrieveOutput(outcome, ownedDeleteResponses);
});
