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
        // `line` must stay: html + github both report printsToStdio() false, and when no reporter prints to stdio
        // playwright unshifts `dot` in CI. Dot's `·`/`F` marks carry no trailing newline, so they land in front of
        // github's `::error`/`::notice` workflow commands, GitHub stops parsing them, and the failure annotations
        // silently vanish. Same reason workflows must not pass `--reporter=` — a CLI list replaces this one wholesale.
        ['line'],
        ['junit', { outputFile: junitOutputFile }],
        // gated on GITHUB_ACTIONS, not CI: output is raw `::error`/`::notice` workflow commands, noise in a local
        // `CI=true` run.
        ...(process.env.GITHUB_ACTIONS ? [['github'] as ReporterDescription] : [])
      ]
    : [['html', { open: 'never' }], ['list']];
