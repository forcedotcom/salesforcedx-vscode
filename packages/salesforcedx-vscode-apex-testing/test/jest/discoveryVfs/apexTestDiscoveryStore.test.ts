/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { ApexTestDiscoveryStore, resolveDiscoveryOrgKey } from '../../../src/discoveryVfs/apexTestDiscoveryStore';
import { getApexTestingClassUri, getOrgIndexUri } from '../../../src/discoveryVfs/apexTestingDiscoveryFs';

describe('ApexTestDiscoveryStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves per-class files and reads discovery index', async () => {
    const store = new ApexTestDiscoveryStore();
    const classes = [{ id: '1', name: 'MyTest', namespacePrefix: '', testMethods: [{ name: 'testOne' }] }];
    const classBodies = new Map([['MyTest', '@isTest private class MyTest {}']]);

    (vscode.workspace.fs.createDirectory as jest.Mock).mockResolvedValue(undefined);
    (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
      new TextEncoder().encode(JSON.stringify({ orgKey: 'org123', updatedAt: 'now', classes }))
    );

    await store.saveDiscoveredClasses('org123', classes, classBodies);
    const snapshot = await store.readDiscoveredClassesIndex('org123');

    expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
    expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
      getApexTestingClassUri('org123', 'MyTest'),
      expect.any(Uint8Array)
    );
    expect(vscode.workspace.fs.readFile).toHaveBeenCalledWith(getOrgIndexUri('org123'));
    expect(snapshot?.classes).toEqual(classes);
  });

  it('returns undefined when snapshot is missing', async () => {
    const store = new ApexTestDiscoveryStore();
    (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(new Error('not found'));

    await expect(store.readDiscoveredClassesIndex('missing')).resolves.toBeUndefined();
  });

  it('resolves org key from org id then username fallback', () => {
    expect(resolveDiscoveryOrgKey({ orgId: '00Dxx', username: 'u@example.com' })).toBe('00Dxx');
    expect(resolveDiscoveryOrgKey({ username: 'u@example.com' })).toBe('u@example.com');
    expect(resolveDiscoveryOrgKey({})).toBe('unknown-org');
  });
});
