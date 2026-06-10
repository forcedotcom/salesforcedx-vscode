/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { updateContext } from '../../../src/vscode/context';

describe('updateContext', () => {
  let executeCommandSpy: jest.SpyInstance;

  beforeEach(() => {
    executeCommandSpy = jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const deletableValueFor = (): boolean =>
    executeCommandSpy.mock.calls.find(call => call[1] === 'sf:default_org_deletable')?.[2] as boolean;

  it('sets sf:default_org_deletable true for a scratch org', async () => {
    await Effect.runPromise(updateContext({ orgId: '00D', isScratch: true }));
    expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'sf:default_org_deletable', true);
    expect(deletableValueFor()).toBe(true);
  });

  it('sets sf:default_org_deletable true for a sandbox org', async () => {
    await Effect.runPromise(updateContext({ orgId: '00D', isSandbox: true }));
    expect(deletableValueFor()).toBe(true);
  });

  it('sets sf:default_org_deletable false when neither isScratch nor isSandbox is set', async () => {
    await Effect.runPromise(updateContext({ orgId: '00D' }));
    expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'sf:default_org_deletable', false);
    expect(deletableValueFor()).toBe(false);
  });
});
