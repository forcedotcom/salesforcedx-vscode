/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { DeployResult } from '@salesforce/source-deploy-retrieve';
import { COMPONENT_STATUS_FAILED } from '../constants';

/** Format deploy results for output */
export const formatDeployOutput = (result: DeployResult): string => {
  const fileResponses = result.getFileResponses();
  const succeeded = fileResponses.filter(r => String(r.state) !== COMPONENT_STATUS_FAILED);
  const failed = fileResponses.filter(r => String(r.state) === COMPONENT_STATUS_FAILED);

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
};
