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
        // github reporter is gated on GITHUB_ACTIONS, not CI: its only output is raw `::error`/`::notice` workflow
        // commands whose paths resolve against GITHUB_WORKSPACE, so a local `CI=true` run (documented in
        // createWebConfig's webServer comment) would get noise instead of annotations. `line` stays because the
        // github reporter's printsToStdio() is false, so it adds no duplicate progress stream.
        ...(process.env.GITHUB_ACTIONS ? [['github'] as ReporterDescription] : [])
      ]
    : [['html', { open: 'never' }], ['list']];
