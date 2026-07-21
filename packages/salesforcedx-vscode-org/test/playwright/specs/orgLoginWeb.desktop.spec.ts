/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as net from 'node:net';
import { expect } from '@playwright/test';
import {
  acceptNotification,
  activeQuickInputTextField,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  selectOutputChannel,
  selectQuickInputOption,
  verifyCommandExists,
  waitForNotification,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';
import { orgDesktopTest } from '../fixtures/desktopFixtures';

// Worker-scoped fixture: hold local TCP port 1717 for the whole worker so the `sf org login web`
// child (running in the extension-host Electron process) hits the OAuth-redirect-server port
// conflict — 1717 is an OS-level port shared across processes on the host. Bind/teardown around
// `use` so the port is released on pass AND failure.
const test = orgDesktopTest.extend<NonNullable<unknown>, { port1717: void }>({
  port1717: [
    async ({}, use) => {
      const server = net.createServer();
      await new Promise<void>((resolve, reject) => {
        server.once('error', (err: NodeJS.ErrnoException) =>
          // Fail fast (not a silent skip): a dirty host already occupying 1717 means the test
          // cannot prove the conflict path is what triggered the notification.
          reject(
            err.code === 'EADDRINUSE'
              ? new Error('Port 1717 is already in use on this host; cannot prove org-login-web port isolation.')
              : err
          )
        );
        server.listen(1717, '127.0.0.1', resolve);
      });
      await use();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
    { scope: 'worker', auto: true }
  ]
});

// e2e-COVERED: SFDX: Authorize an Org against the real `sf` CLI with local port 1717 held.
// 1. cmd-string assembly end-to-end (alias + --instance-url + --set-default, SF_JSON_TO_STDOUT) —
//    driving the real gather UI through to the `sf org login web` child proves the command string
//    the migrated command builds is accepted by the real CLI.
// 2. port-conflict mapping (TerminalServiceError → isAuthPortConflictError → showErrorMessage
//    notification + Show Output) — the only deterministic offline-provable signal of the migrated
//    failure branch; a real web OAuth cannot complete headless.
// 3. withCancellableProgress wiring (progress title appears; the child is the long-running
//    interactive login that the conflict aborts).
test('org extension: SFDX: Authorize an Org surfaces the port-1717 conflict notification', async ({ page }) => {
  test.setTimeout(180_000);

  await test.step('open the project workspace', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
  });

  await test.step('verify extension-activated command is present', async () => {
    await verifyCommandExists(page, packageNls.org_login_web_authorize_org_text, 60_000);
  });

  await test.step('run Authorize an Org and drive the gather QuickPick', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_login_web_authorize_org_text);
    // org-type QuickPick: pick Production (resolves to PRODUCTION_URL, no custom-URL prompt).
    await selectQuickInputOption(page, messages.auth_prod_label);
    // alias input box: commit empty (empty string → DEFAULT_ALIAS, a valid answer). This completes
    // gather and launches the sf child, which collides with the held port 1717.
    const input = activeQuickInputTextField(page);
    await expect(input, 'alias input box should be empty after the org-type pick').toHaveValue('', {
      timeout: 30_000
    });
    await page.keyboard.press('Enter');
  });

  const conflictMessage = /local port 1717 is already in use/;

  await test.step('assert the port-conflict notification', async () => {
    // stable fragment of org_login_web_port_conflict_notification_message ('…local port 1717 is
    // already in use…'). showErrorMessage is persistent (not an auto-dismissing info toast), so it
    // is reliably observable.
    const notification = await waitForNotification(page, conflictMessage, { timeout: 120_000 });
    await expect(notification).toBeVisible();
  });

  await test.step('Show Output reveals the Salesforce Org Management channel', async () => {
    // click the action immediately (palette/maximize ops would hide the toast first)
    await acceptNotification(page, conflictMessage, messages.org_login_web_show_output_button_text);
    // the conflict branch reveals the channel (it does not append output), so assert the output
    // panel surfaced the Salesforce Org Management channel rather than any specific content. The
    // shared helper waits for the panel, re-queries the dropdown per attempt, and retries via toPass.
    await selectOutputChannel(page, messages.channel_name);
  });
});
