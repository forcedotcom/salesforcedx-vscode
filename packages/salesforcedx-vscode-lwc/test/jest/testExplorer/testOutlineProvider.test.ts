/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { URI } from 'vscode-uri';

// iconPaths.ts calls vscode.extensions.getExtension at module scope, so mock before import
const mockUri = URI.parse('https://salesforce.com');
(vscode.extensions.getExtension as jest.Mock).mockReturnValue({ extensionUri: mockUri });

import { SfTestOutlineProvider } from '../../../src/testSupport/testExplorer/testOutlineProvider';

describe('testOutlineProvider Unit Tests.', () => {
  const vscodeMocked = jest.mocked(vscode);
  let commandMock: jest.SpyInstance;

  beforeEach(() => {
    commandMock = jest.spyOn(vscodeMocked.commands, 'executeCommand');
  });

  it('sets test outline provider id', () => {
    const provider = new SfTestOutlineProvider();
    expect(provider.getId()).toBe('sf.lightning.lwc.test.view');
  });

  it('calls collapse all lwc tests', () => {
    const provider = new SfTestOutlineProvider();

    void provider.collapseAll();

    expect(commandMock).toHaveBeenCalledTimes(1);
    expect(commandMock.mock.calls[0].length).toBe(1);
    expect(commandMock.mock.calls[0][0]).toBe(`workbench.actions.treeView.${provider.getId()}.collapseAll`);
  });
});
