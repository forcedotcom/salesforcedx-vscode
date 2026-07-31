/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import {
  clickOrgPickerStatusBar,
  closeWelcomeTabs,
  createMinimalOrg,
  ensureSecondarySideBarHidden,
  env,
  execAsync,
  expectOrgPickerStatusBar,
  MINIMAL_ORG_ALIAS,
  selectOrgInPicker,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { desktopTest as test } from '../fixtures/desktopFixtures';

const STATE_FILE = '.workspace-context-state.json';

type CapturedState = {
  eventCount: number;
  event?: { username?: string; alias?: string; orgId?: string };
  getters: { username?: string; alias?: string; orgId?: string };
};

type OrgIdentity = { username: string; orgId: string };

const readState = async (workspaceDir: string): Promise<CapturedState> =>
  JSON.parse(await readFile(join(workspaceDir, STATE_FILE), 'utf8')) as CapturedState;

const getOrgIdentity = async (): Promise<OrgIdentity> => {
  const result = JSON.parse((await execAsync(`sf org display -o ${MINIMAL_ORG_ALIAS} --json`, { env })).stdout) as {
    result: OrgIdentity;
  };
  return result.result;
};

test('WorkspaceContext tracks real default-org picker switches', async ({ page, workspaceDir }) => {
  test.setTimeout(120_000);
  await createMinimalOrg();
  const { username, orgId } = await getOrgIdentity();

  await test.step('capture the activation snapshot without an event', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await expectOrgPickerStatusBar(page, MINIMAL_ORG_ALIAS, { timeout: 60_000 });
    await expect.poll(() => readState(workspaceDir)).toMatchObject({
      eventCount: 0,
      getters: { username, alias: MINIMAL_ORG_ALIAS, orgId }
    });
  });

  await test.step('switch to username and capture one synchronous event', async () => {
    await clickOrgPickerStatusBar(page, MINIMAL_ORG_ALIAS);
    await selectOrgInPicker(page, username);
    await expectOrgPickerStatusBar(page, username);
    await expect.poll(() => readState(workspaceDir)).toMatchObject({
      eventCount: 1,
      event: { username },
      getters: { username, orgId }
    });
    expect((await readState(workspaceDir)).event?.alias).toBeUndefined();
    expect((await readState(workspaceDir)).getters.alias).toBeUndefined();
  });

  await test.step('switch back to alias and capture exactly one more event', async () => {
    await clickOrgPickerStatusBar(page, username);
    await selectOrgInPicker(page, MINIMAL_ORG_ALIAS);
    await expectOrgPickerStatusBar(page, MINIMAL_ORG_ALIAS);
    await expect.poll(() => readState(workspaceDir)).toMatchObject({
      eventCount: 2,
      event: { username, alias: MINIMAL_ORG_ALIAS },
      getters: { username, alias: MINIMAL_ORG_ALIAS, orgId }
    });
  });
});
