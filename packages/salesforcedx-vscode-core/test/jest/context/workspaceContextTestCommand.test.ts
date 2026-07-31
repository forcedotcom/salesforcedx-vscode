/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { startWorkspaceContextTestCapture } from '../../../src/context/workspaceContextTestCommand';

describe('WorkspaceContext test capture', () => {
  it('registers and starts capture for packaged E2E runs', async () => {
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: jest.fn().mockReturnValue('e2e-test')
    } as never);

    await startWorkspaceContextTestCapture({
      extensionMode: vscode.ExtensionMode.Production,
      subscriptions: []
    } as never);

    expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sf.internal.workspaceContext.capture', expect.any(Function));
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      'sf.internal.workspaceContext.setTargetOrgToUsername',
      expect.any(Function)
    );
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('sf.internal.workspaceContext.capture');
  });

  it('does not register or execute the capture command outside E2E', async () => {
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: jest.fn().mockReturnValue(undefined)
    } as never);

    await startWorkspaceContextTestCapture({
      extensionMode: vscode.ExtensionMode.Production,
      subscriptions: []
    } as never);

    expect(vscode.commands.registerCommand).not.toHaveBeenCalled();
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });
});
