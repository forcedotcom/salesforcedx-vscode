/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ReporterDescription } from '@playwright/test';

/** Shared CI/local reporter policy for the web and desktop config factories */
export const createReporter = (junitOutputFile: string): ReporterDescription[] =>
  process.env.CI
    ? [
        ['html', { open: 'never' }],
        ['line'],
        ['junit', { outputFile: junitOutputFile }],
        // gated on GITHUB_ACTIONS, not CI: output is raw `::error`/`::notice` workflow commands, noise in a local
        // `CI=true` run. `line` stays — github reporter's printsToStdio() is false, so no duplicate progress stream.
        ...(process.env.GITHUB_ACTIONS ? [['github'] as ReporterDescription] : [])
      ]
    : [['html', { open: 'never' }], ['list']];
