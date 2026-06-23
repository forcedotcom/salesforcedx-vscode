/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DeployOutcome, FileResponseInfo } from 'salesforcedx-vscode-services';

const makeKey = (type: string, name: string): string => `${type}#${name}`;

/**
 * Merge file-level failures with `componentFailures`, matching
 * plugin-deploy-retrieve `DeployResultFormatter.getFileResponseFailures` / `sf project deploy start`.
 * Now operates on owned DeployOutcome (sync, no Effect needed).
 */
export const getMergedDeployFailures = (outcome: DeployOutcome): readonly FileResponseInfo[] => {
  const failures = outcome.fileResponses.filter(fr => fr.state === 'Failed');

  if (outcome.componentFailures.length <= failures.length) {
    return failures;
  }

  const seen = new Set(failures.map(f => makeKey(f.type, f.fullName)));

  const extras = outcome.componentFailures
    .filter(m => !seen.has(makeKey(m.type, m.fullName)))
    .map(
      (m): FileResponseInfo => ({
        fullName: m.fullName,
        type: m.type,
        state: 'Failed',
        error: m.problem,
        problemType: m.problemType
      })
    );

  return [...failures, ...extras];
};
