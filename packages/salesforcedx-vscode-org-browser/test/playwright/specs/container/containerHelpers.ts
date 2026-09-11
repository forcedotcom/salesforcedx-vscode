/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Shared setup for the Org Browser container specs (ADR 0022). The Code Builder container is a
 * single, long-lived editor session (playwright.config.container: workers=1, fullyParallel=false),
 * and the Org Browser persists its view state — text filter and the showLocal/showOrg toggles — in
 * `workspaceState` (see src/index.ts). That state therefore survives across tests in the shared
 * workbench, so a filter left active by one spec would break the next spec's `openOrgBrowser()`,
 * which asserts the unfiltered tree shows ≥5 root types. `normalizeOrgBrowserFilters` restores the
 * default state (no text filter, both toggles ON) before each test, then leaves the view closed so
 * every test's own `openOrgBrowser()` opens it fresh with a single activity-bar click.
 *
 * This is not a `*.spec.ts` file, so Playwright does not collect it as a test.
 */

import { expect, type Page } from '@playwright/test';
import {
  DREAMHOUSE_ORG_ALIAS,
  env,
  execAsync,
  MINIMAL_ORG_ALIAS,
  switchDefaultOrgViaPicker
} from '@salesforce/playwright-vscode-ext';
import type { OrgBrowserPage } from '../../pages/orgBrowserPage';

const FILTER_TOOLBAR_BUTTON = '[aria-label="Filter by Type/Component"], [aria-label="Edit Filter (active)"]';

/** Restore the Org Browser to its default view state (no text filter, both toggles ON) and leave it closed. */
export const normalizeOrgBrowserFilters = async (orgBrowserPage: OrgBrowserPage): Promise<void> => {
  const { page, activityBarItem } = orgBrowserPage;
  await orgBrowserPage.waitForProject();

  // Reveal the Org Browser only if it isn't already showing — its toolbar filter button is present
  // whenever the view is open, regardless of how many types (if any) the current filter leaves.
  const filterButton = page.locator(FILTER_TOOLBAR_BUTTON).first();
  if (!(await filterButton.isVisible({ timeout: 2000 }).catch(() => false))) {
    await activityBarItem.click();
    await expect(filterButton).toBeVisible({ timeout: 15_000 });
  }

  // Clear a committed text filter left by a prior test (state lives in workspaceState).
  const activeFilter = page.locator('[aria-label="Edit Filter (active)"]').first();
  if (await activeFilter.isVisible({ timeout: 1000 }).catch(() => false)) {
    await orgBrowserPage.applyTextFilter('');
  }

  // Restore both dimension toggles ON — the "Show ..." button only appears when that dimension is OFF.
  for (const label of ['Show Local Types', 'Show Org Types']) {
    const button = page.locator(`[aria-label="${label}"]`).first();
    if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
      await button.click();
    }
  }

  // Leave the view closed so each test's openOrgBrowser() opens it fresh with a single click.
  await activityBarItem.click();
};

/**
 * Resolve an org's username from the host CLI. The container boots the minimal org UNALIASED, so the
 * in-container picker/status bar show its USERNAME (not its host alias) — the label the switch helpers
 * must target. The Dreamhouse extra org keeps its alias in-container. Returns undefined when the alias
 * isn't authed on the host (a local run without the multi-org + Dreamhouse setup), so callers `test.skip`.
 */
const resolveOrgUsername = async (alias: string): Promise<string | undefined> => {
  const { stdout } = await execAsync(`sf org display -o ${alias} --json`, { env });
  const parsed = JSON.parse(stdout) as { result?: { username?: string } };
  return parsed.result?.username;
};

/**
 * Resolve the boot org's in-container label (its username) and confirm the Dreamhouse extra org is
 * authed. Container Dreamhouse specs `test.skip` when either is missing (CI-only capability via
 * CB_EXTRA_ORG_ALIASES=orgBrowserDreamhouseTestOrg for this package).
 */
export const resolveMultiOrgLabels = async (): Promise<{ bootOrgUsername?: string; dreamhouseAuthed?: string }> => {
  const bootOrgUsername = await resolveOrgUsername(MINIMAL_ORG_ALIAS).catch(() => undefined);
  const dreamhouseAuthed = await resolveOrgUsername(DREAMHOUSE_ORG_ALIAS).catch(() => undefined);
  return { bootOrgUsername, dreamhouseAuthed };
};

/** Switch the default org from the boot org to the aliased Dreamhouse org via the status-bar picker. */
export const switchToDreamhouseOrg = (page: Page, bootOrgLabel: string): Promise<void> =>
  switchDefaultOrgViaPicker(page, {
    fromLabel: bootOrgLabel,
    filterText: DREAMHOUSE_ORG_ALIAS,
    expectLabel: DREAMHOUSE_ORG_ALIAS,
    assertListsOrg: DREAMHOUSE_ORG_ALIAS
  });

/**
 * Restore the default org back to the boot org (by username) through the SAME picker UI. REQUIRED in a
 * `finally`: the shared serial container session must not be left defaulted to the Dreamhouse org, or
 * later container specs (which assume the boot org) run against the wrong org.
 */
export const restoreBootOrg = (page: Page, bootOrgLabel: string): Promise<void> =>
  switchDefaultOrgViaPicker(page, {
    fromLabel: DREAMHOUSE_ORG_ALIAS,
    filterText: bootOrgLabel,
    expectLabel: bootOrgLabel
  });
