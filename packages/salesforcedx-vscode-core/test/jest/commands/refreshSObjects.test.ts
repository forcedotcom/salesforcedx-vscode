/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fileOrFolderExists } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { initSObjectDefinitions } from '../../../src/commands/refreshSObjects';

jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  ...jest.requireActual<typeof import('@salesforce/salesforcedx-utils-vscode')>(
    '@salesforce/salesforcedx-utils-vscode'
  ),
  fileOrFolderExists: jest.fn()
}));

jest.mock('../../../src/telemetry', () => ({
  telemetryService: { sendEventData: jest.fn() }
}));

describe('initSObjectDefinitions', () => {
  it('propagates the refresh command rejection', async () => {
    const rejection = new Error('refresh failed');
    jest.mocked(fileOrFolderExists).mockResolvedValue(false);
    jest.mocked(vscode.commands.executeCommand).mockRejectedValue(rejection);

    await expect(initSObjectDefinitions('/project', true)).rejects.toBe(rejection);

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('sf.internal.refreshsobjects', 'startup');
  });
});
