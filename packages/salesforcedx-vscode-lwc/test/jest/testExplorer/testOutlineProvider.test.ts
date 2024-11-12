/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { extensionUris } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';

// SfTestOutlineProvider has a hidden dependency on @salesforce/salesforcedx-utils-vscode.extensionUri that needs to be mocked
// and, crucially, the mock has to be done prior to the class import!
// for our purposes, the return value has no bearing on what we're testing
const mockUri = vscode.Uri.parse('https://salesforce.com');
jest.spyOn(extensionUris, 'extensionUri').mockReturnValue(mockUri);
jest.spyOn(extensionUris, 'join').mockReturnValue(mockUri);

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

    expect(commandMock.mock.calls.length).toBe(1);
    expect(commandMock.mock.calls[0].length).toBe(1);
    expect(commandMock.mock.calls[0][0]).toBe(`workbench.actions.treeView.${provider.getId()}.collapseAll`);
  });
});
