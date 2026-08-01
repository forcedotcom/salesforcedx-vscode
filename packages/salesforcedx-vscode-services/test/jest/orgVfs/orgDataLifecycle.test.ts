/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { reconcileOrgDataLifecycle } from '../../../src/orgVfs/orgDataLifecycle';
import type { FsService } from '../../../src/vscode/fsService';

describe('org-data lifecycle', () => {
  afterEach(() => {
    delete (vscode.window as unknown as { tabGroups?: unknown }).tabGroups;
  });

  it('closes stale and legacy tabs before purging stale org data', async () => {
    const events: string[] = [];
    const currentTab = {
      input: new vscode.TabInputText(URI.parse('sf-org-data:/orgs/org123/apex-testing/classes/Current.cls'))
    } as vscode.Tab;
    const staleTab = {
      input: new vscode.TabInputText(URI.parse('sf-org-data:/orgs/org456/apex-testing/classes/Stale.cls'))
    } as vscode.Tab;
    const legacyTab = {
      input: new vscode.TabInputText(URI.parse('apex-testing:/orgs/org123/classes/Legacy.cls'))
    } as vscode.Tab;
    const close = jest.fn(async (tabs: readonly vscode.Tab[]) => {
      events.push(`close:${tabs.length}`);
      return true;
    });
    (vscode.window as unknown as { tabGroups: unknown }).tabGroups = {
      all: [{ tabs: [currentTab, staleTab, legacyTab] }],
      close
    };
    const staleOrg = URI.parse('sf-org-data:/orgs/org456');
    const fsService = {
      readDirectory: () => Effect.succeed([URI.parse('sf-org-data:/orgs/org123'), staleOrg]),
      deleteOrgData: (uri: URI) =>
        Effect.sync(() => {
          events.push(`delete:${uri.path}`);
        })
    } as unknown as InstanceType<typeof FsService>;

    await Effect.runPromise(reconcileOrgDataLifecycle('org123', false, fsService));

    expect(close).toHaveBeenCalledWith([staleTab, legacyTab], true);
    expect(events).toEqual(['close:2', 'delete:/orgs/org456']);
  });

  it('closes every restored org-data tab on first activation', async () => {
    const restoredTab = {
      input: new vscode.TabInputText(URI.parse('sf-org-data:/orgs/org123/apex-testing/classes/Restored.cls'))
    } as vscode.Tab;
    const close = jest.fn().mockResolvedValue(true);
    (vscode.window as unknown as { tabGroups: unknown }).tabGroups = {
      all: [{ tabs: [restoredTab] }],
      close
    };
    const fsService = {
      readDirectory: () => Effect.succeed([]),
      deleteOrgData: () => Effect.void
    } as unknown as InstanceType<typeof FsService>;

    await Effect.runPromise(reconcileOrgDataLifecycle('org123', true, fsService));

    expect(close).toHaveBeenCalledWith([restoredTab], true);
  });
});
