/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { iconHelpers } from '../../../src/views/icons/iconHelpers';

import { getTestOutlineProvider, TEST_OUTLINE_PROVIDER_BASE_ID } from '../../../src/views/testOutlineProvider';

describe('testOutlineProvider Unit Tests.', () => {
  const vscodeMocked = jest.mocked(vscode);
  let commandMock: jest.SpyInstance;

  beforeEach(() => {
    // testOutlineProvider has a hidden dependency on iconHelpers.getIconPath that needs to be mocked
    // for our purposes, the return value has no bearing on what we're testing
    jest.spyOn(iconHelpers, 'getIconPath').mockReturnValue(URI.parse('https://salesforce.com'));
    commandMock = jest.spyOn(vscodeMocked.commands, 'executeCommand');
  });

  it('calls collapse all apex tests', () => {
    const provider = getTestOutlineProvider();

    void provider.collapseAll();

    expect(commandMock).toHaveBeenCalledTimes(1);
    expect(commandMock.mock.calls[0].length).toBe(1);
    expect(commandMock.mock.calls[0][0]).toBe(
      `workbench.actions.treeView.${TEST_OUTLINE_PROVIDER_BASE_ID}.collapseAll`
    );
  });
});
