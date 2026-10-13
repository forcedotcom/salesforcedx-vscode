/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { waitForOutputChannelText } from '@salesforce/playwright-vscode-ext';
import type { Page } from '@playwright/test';
import { APEX_RUN_CHANNEL_FAILURES } from '../constants';

/** Check every post-run Apex Testing line for socket-close failures, not just the summary. */
export const waitForApexRunOutputLine = (page: Page, expectedText: string): Promise<void> =>
  waitForOutputChannelText(page, { expectedText, timeout: 60_000, failIfChannelIncludes: APEX_RUN_CHANNEL_FAILURES });
