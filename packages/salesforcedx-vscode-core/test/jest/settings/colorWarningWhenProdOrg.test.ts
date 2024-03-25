/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { WorkspaceContext } from '../../../src/context';
import { getDefaultUsernameOrAlias } from '../../../src/context/workspaceOrgType';
import { colorWhenProductionOrg } from '../../../src/settings/colorWarningWhenProdOrg';
import { SfdxCoreSettings } from '../../../src/settings/sfdxCoreSettings';
import { OrgAuthInfo } from '../../../src/util';

// Mocking getDefaultUsernameOrAlias function
jest.mock('../../../src/context/workspaceOrgType', () => ({
  getDefaultUsernameOrAlias: jest.fn()
}));

// Mocking OrgAuthInfo class
jest.mock('../../../src/util', () => ({
  OrgAuthInfo: {
    getUsername: jest.fn(),
    isAProductionOrg: jest.fn()
  }
}));

// Mocking SfdxCoreSettings class
jest.mock('../../../src/settings/sfdxCoreSettings', () => ({
  SfdxCoreSettings: {
    getInstance: jest.fn()
  }
}));

const mockWorkspaceContextInstance = {
  onOrgChange: jest.fn()
};

// Mock the WorkspaceContext class
jest.mock('../../../src/context', () => ({
  WorkspaceContext: jest.fn().mockImplementation(() => ({
    getInstance: jest.fn().mockReturnValue(mockWorkspaceContextInstance)
  }))
}));

describe('colorWhenProductionOrg', () => {
  let mockConfiguration: any;
  let mockOnOrgChange: any;

  beforeEach(() => {
    mockConfiguration = {
      update: jest.fn()
    };

    mockOnOrgChange = jest.fn();
    (SfdxCoreSettings.getInstance as jest.Mock).mockReturnValue({
      getColorWarningWhenProductionOrg: jest.fn(() => true),
      getColorWarningWhenProductionOrgColor: jest.fn()
    });

    WorkspaceContext.getInstance = jest.fn().mockReturnValue({
      onOrgChange: mockOnOrgChange
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should update status bar color when production org is detected', async () => {
    (getDefaultUsernameOrAlias as jest.Mock).mockResolvedValue('testUsername');
    (OrgAuthInfo.getUsername as jest.Mock).mockResolvedValue('testUsername');
    (OrgAuthInfo.isAProductionOrg as jest.Mock).mockResolvedValue(true);

    const updated = await colorWhenProductionOrg();

    expect(updated).toBe(true);
  });

  it('should not update status bar color when no username or alias is found', async () => {
    (getDefaultUsernameOrAlias as jest.Mock).mockResolvedValue(null);

    const updated = await colorWhenProductionOrg();

    expect(updated).toBe(false);
  });

  it('should not update status bar color when color warning for production org is not activated', async () => {
    (getDefaultUsernameOrAlias as jest.Mock).mockResolvedValue('testUsername');
    (OrgAuthInfo.getUsername as jest.Mock).mockResolvedValue('testUsername');
    (SfdxCoreSettings.getInstance as jest.Mock).mockReturnValue({
      getColorWarningWhenProductionOrg: jest.fn(() => false),
      getColorWarningWhenProductionOrgColor: jest.fn(() => undefined)
    });

    const updated = await colorWhenProductionOrg();
    expect(updated).toBe(false);
  });

  it('should not update status bar color when org is not a production org', async () => {
    (getDefaultUsernameOrAlias as jest.Mock).mockResolvedValue('testUsername');
    (OrgAuthInfo.getUsername as jest.Mock).mockResolvedValue('testUsername');
    (OrgAuthInfo.isAProductionOrg as jest.Mock).mockResolvedValue(false);

    const updated = await colorWhenProductionOrg();

    expect(updated).toBe(true);
  });
});
