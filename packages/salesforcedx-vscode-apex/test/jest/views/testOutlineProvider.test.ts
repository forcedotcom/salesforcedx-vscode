/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { iconHelpers } from '../../../src/views/icons/iconHelpers';

import { getTestOutlineProvider } from '../../../src/views/testOutlineProvider';

describe('testOutlineProvider Unit Tests.', () => {
  const vscodeMocked = jest.mocked(vscode);
  let commandMock: jest.SpyInstance;

  beforeEach(() => {
    // testOutlineProvider has a hidden dependency on iconHelpers.getIconPath that needs to be mocked
    // for our purposes, the return value has no bearing on what we're testing
    jest.spyOn(iconHelpers, 'getIconPath').mockReturnValue(vscode.Uri.parse('https://salesforce.com'));
    commandMock = jest.spyOn(vscodeMocked.commands, 'executeCommand');
  });

  it('sets test outline provider id', () => {
    const provider = getTestOutlineProvider();
    expect(provider.getId()).toBe('sf.test.view');
  });

  it('calls collapse all apex tests', () => {
    const provider = getTestOutlineProvider();

    void provider.collapseAll();

    expect(commandMock.mock.calls.length).toBe(1);
    expect(commandMock.mock.calls[0].length).toBe(1);
    expect(commandMock.mock.calls[0][0]).toBe(`workbench.actions.treeView.${provider.getId()}.collapseAll`);
  });
});
