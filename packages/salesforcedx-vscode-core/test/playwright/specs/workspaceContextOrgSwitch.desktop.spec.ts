/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import * as Schema from 'effect/Schema';
import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  env,
  executeCommandWithCommandPalette,
  execAsync,
  expectOrgPickerStatusBar,
  MINIMAL_ORG_ALIAS,
  selectOrgInPicker,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../fixtureExtensions/workspaceContext/package.nls.json';
import { workspaceContextDesktopTest as test } from '../fixtures/workspaceContextDesktopFixtures';

const STATE_FILE = '.workspace-context-state.json';

const OrgIdentity = Schema.Struct({ username: Schema.String, id: Schema.String });
const WorkspaceIdentity = Schema.Struct({
  username: Schema.optional(Schema.String),
  alias: Schema.optional(Schema.String),
  orgId: Schema.optional(Schema.String)
});
const CapturedState = Schema.Struct({
  eventCount: Schema.Number,
  event: Schema.optional(WorkspaceIdentity),
  getters: WorkspaceIdentity,
  transitionComplete: Schema.optional(Schema.Boolean)
});
const OrgDisplayResult = Schema.Struct({ result: OrgIdentity });

const readState = async (workspaceDir: string): Promise<typeof CapturedState.Type> =>
  Schema.decodeUnknownSync(CapturedState)(JSON.parse(await readFile(join(workspaceDir, STATE_FILE), 'utf8')));

const getOrgIdentity = async (): Promise<typeof OrgIdentity.Type> => {
  const result = Schema.decodeUnknownSync(OrgDisplayResult)(
    JSON.parse((await execAsync(`sf org display -o ${MINIMAL_ORG_ALIAS} --json`, { env })).stdout)
  );
  return result.result;
};

test('WorkspaceContext tracks real default-org picker switches', async ({ page, workspaceDir }) => {
  test.setTimeout(120_000);
  const { username, id: orgId } = await getOrgIdentity();

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

  await test.step('configure the username and capture one synchronous event', async () => {
    await executeCommandWithCommandPalette(page, packageNls.workspace_context_set_username_test_text);
    await expectOrgPickerStatusBar(page, MINIMAL_ORG_ALIAS);
    await expect.poll(() => readState(workspaceDir)).toMatchObject({
      eventCount: 1,
      event: { username },
      getters: { username, orgId }
    });
    expect((await readState(workspaceDir)).event?.alias).toBeUndefined();
    expect((await readState(workspaceDir)).getters.alias).toBeUndefined();
  });

  await test.step('switch back to alias and capture exactly one more event', async () => {
    await executeCommandWithCommandPalette(page, packageNls.workspace_context_select_org_test_text);
    await selectOrgInPicker(page, MINIMAL_ORG_ALIAS);
    await expectOrgPickerStatusBar(page, MINIMAL_ORG_ALIAS);
    await expect.poll(() => readState(workspaceDir)).toMatchObject({ transitionComplete: true });
    expect(await readState(workspaceDir)).toMatchObject({
      eventCount: 2,
      event: { username, alias: MINIMAL_ORG_ALIAS },
      getters: { username, alias: MINIMAL_ORG_ALIAS, orgId }
    });
  });
});
