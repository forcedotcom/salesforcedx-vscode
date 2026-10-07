/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type Page } from '@playwright/test';
import { closeWelcomeTabs } from '../utils/helpers';
import { ensureSecondarySideBarHidden } from '../utils/workflows';
import { clearAllNotifications, closeAllEditors } from './nativeCommands';

/**
 * Reset the ONE shared, serial Code Builder container workbench to a known-clean baseline between
 * tests. Container specs run against a single persistent workbench (workers:1), so leftover editors,
 * notifications, welcome/walkthrough tabs, or a visible secondary sidebar from a prior spec can
 * poison the next one. Call this from a container spec's `beforeEach` for the generic cleanup;
 * keep any spec-specific setup (org auth, deploys, feature flags, output-channel selection, etc.)
 * alongside it.
 *
 * Best-effort and idempotent: every step tolerates a missing element and never throws, so a spec
 * that (for example) never opens a welcome tab or secondary sidebar still passes cleanly.
 */
export const resetContainerWorkbench = async (page: Page): Promise<void> => {
  await closeWelcomeTabs(page).catch(() => {});
  await ensureSecondarySideBarHidden(page).catch(() => {});
  await closeAllEditors(page).catch(() => {});
  await clearAllNotifications(page).catch(() => {});
};
