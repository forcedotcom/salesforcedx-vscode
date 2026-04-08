/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { getSalesforceVSCodeOrgExtension } from '../../../src/context/orgExtensionUtils';

const mockedVSCode = jest.mocked(vscode);

describe('getSalesforceVSCodeOrgExtension', () => {
  const orgExtensionId = 'salesforce.salesforcedx-vscode-org';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns undefined when the org extension is not installed', async () => {
    mockedVSCode.extensions.getExtension.mockReturnValue(undefined);

    await expect(getSalesforceVSCodeOrgExtension()).resolves.toBeUndefined();
    expect(mockedVSCode.extensions.getExtension).toHaveBeenCalledWith(orgExtensionId);
  });

  it('returns the extension when already active', async () => {
    const dummyExtension = {
      isActive: true,
      exports: { channelService: {} }
    } as unknown as vscode.Extension<{ channelService: unknown }>;

    mockedVSCode.extensions.getExtension.mockReturnValue(dummyExtension);

    await expect(getSalesforceVSCodeOrgExtension()).resolves.toBe(dummyExtension);
  });

  it('activates when inactive and returns the extension', async () => {
    const activate = jest.fn().mockResolvedValue(undefined);
    const dummyExtension = {
      isActive: false,
      activate,
      exports: { channelService: {} }
    } as unknown as vscode.Extension<{ channelService: unknown }>;

    mockedVSCode.extensions.getExtension.mockReturnValue(dummyExtension);

    await expect(getSalesforceVSCodeOrgExtension()).resolves.toBe(dummyExtension);
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('returns undefined when activation fails', async () => {
    const activate = jest.fn().mockRejectedValue(new Error('activation failed'));
    const dummyExtension = {
      isActive: false,
      activate,
      exports: { channelService: {} }
    } as unknown as vscode.Extension<{ channelService: unknown }>;

    mockedVSCode.extensions.getExtension.mockReturnValue(dummyExtension);

    await expect(getSalesforceVSCodeOrgExtension()).resolves.toBeUndefined();
  });
});
