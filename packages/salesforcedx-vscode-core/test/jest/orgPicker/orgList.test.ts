/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthFields, OrgAuthorization, StateAggregator } from '@salesforce/core';
import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { nls } from '../../../src/messages';
import { OrgList } from '../../../src/orgPicker';
import { OrgAuthInfo } from '../../../src/util';
import * as orgUtil from '../../../src/util/orgUtil';

describe('OrgList tests', () => {
  let orgList: OrgList;
  let getDevHubUsernameMock: jest.SpyInstance;
  let getAllMock: jest.SpyInstance;
  let getAllAliasesForMock: jest.SpyInstance;
  let getUsernameForMock: jest.SpyInstance;
  let getAuthFieldsForMock: jest.SpyInstance;
  let fakeStateAggregator: any;
  const mockStatusBarItem: any = {};
  let mockWatcher: any;

  const dummyDevHubUsername = 'test-devhub@example.com';

  const createOrgAuthorization = (overrides: Partial<OrgAuthorization> = {}): OrgAuthorization => ({
    orgId: '000',
    username: 'test-username@example.com',
    oauthMethod: 'unknown',
    aliases: [],
    configs: [],
    isScratchOrg: undefined,
    isDevHub: undefined,
    isSandbox: undefined,
    instanceUrl: undefined,
    accessToken: undefined,
    error: undefined,
    isExpired: false,
    ...overrides
  });

  const orgAuth = createOrgAuthorization();
  const orgAuthWithError = createOrgAuthorization({
    username: 'error-org@example.com',
    error: 'Some error'
  });
  const orgAuthScratchOrg = createOrgAuthorization({ isScratchOrg: true });
  const orgAuthWithAlias = createOrgAuthorization({
    username: 'test-username@example.com',
    aliases: ['alias1']
  });
  const validOrgAuth = createOrgAuthorization({
    username: 'valid-org@example.com'
  });

  beforeEach(() => {
    mockStatusBarItem.tooltip = '';
    mockStatusBarItem.command = '';
    mockStatusBarItem.text = '';
    mockStatusBarItem.show = jest.fn();
    mockStatusBarItem.dispose = jest.fn();
    mockWatcher = {
      onDidChange: jest.fn(),
      onDidCreate: jest.fn(),
      onDidDelete: jest.fn()
    };
    (vscode.workspace.createFileSystemWatcher as jest.Mock).mockReturnValue(mockWatcher);
    (vscode.window.createStatusBarItem as jest.Mock).mockReturnValue(mockStatusBarItem);
    orgList = new OrgList();
    getAuthFieldsForMock = jest.spyOn(orgUtil, 'getAuthFieldsFor');
    getUsernameForMock = jest.spyOn(ConfigUtil, 'getUsernameFor');
    getDevHubUsernameMock = jest.spyOn(OrgAuthInfo, 'getDevHubUsername');
    getAllMock = jest.fn();
    fakeStateAggregator = {
      aliases: {
        getAll: getAllMock
      }
    };
    jest.spyOn(StateAggregator, 'create').mockResolvedValue(fakeStateAggregator);
    getAllAliasesForMock = jest.spyOn(ConfigUtil, 'getAllAliasesFor');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('filterAuthInfo', () => {
    it('should filter out orgs with the scratchAdminUsername field', async () => {
      const orgAuths = [orgAuth];
      getAuthFieldsForMock.mockResolvedValueOnce({
        scratchAdminUsername: 'admin@example.com'
      } as AuthFields);
      getDevHubUsernameMock.mockResolvedValueOnce(null);

      const result = await orgList.filterAuthInfo(orgAuths);

      expect(result).toEqual([]);
    });

    it('should filter out scratch orgs parented by non-default Dev Hubs', async () => {
      const orgAuths = [orgAuthScratchOrg];
      getAuthFieldsForMock.mockResolvedValueOnce({
        devHubUsername: 'other-devhub@example.com'
      } as AuthFields);
      getDevHubUsernameMock.mockResolvedValueOnce(dummyDevHubUsername);

      const result = await orgList.filterAuthInfo(orgAuths);

      expect(result).toEqual([]);
    });

    it('should include aliases in the result if available', async () => {
      const orgAuths = [orgAuthWithAlias, validOrgAuth];
      getDevHubUsernameMock.mockResolvedValue(null);
      getAllMock.mockResolvedValueOnce(orgAuthWithAlias.aliases).mockResolvedValueOnce(orgAuth.aliases);
      getAllAliasesForMock.mockResolvedValueOnce(orgAuthWithAlias.aliases).mockResolvedValueOnce(orgAuth.aliases);
      getAuthFieldsForMock.mockResolvedValueOnce(orgAuthWithAlias).mockResolvedValueOnce(orgAuth);
      const result = await orgList.filterAuthInfo(orgAuths);

      expect(result).toEqual(['alias1 - test-username@example.com', validOrgAuth.username]);
    });

    it('should filter out org authorizations with errors', async () => {
      const orgAuths = [orgAuthWithError, orgAuth];
      getAuthFieldsForMock.mockResolvedValueOnce({} as AuthFields);
      getDevHubUsernameMock.mockResolvedValueOnce(null);

      const result = await orgList.filterAuthInfo(orgAuths);

      expect(result).toEqual([orgAuth.username]);
    });

    it('should return a list of valid org authorizations', async () => {
      const orgAuths = [validOrgAuth, orgAuthScratchOrg, orgAuthWithError];
      getUsernameForMock.mockResolvedValueOnce(validOrgAuth.username);
      getUsernameForMock.mockResolvedValueOnce(orgAuthScratchOrg.username);
      getAuthFieldsForMock.mockResolvedValueOnce(validOrgAuth as AuthFields);
      getAuthFieldsForMock.mockResolvedValueOnce(orgAuthScratchOrg as AuthFields);
      getDevHubUsernameMock.mockResolvedValueOnce(dummyDevHubUsername);

      const result = await orgList.filterAuthInfo(orgAuths);

      expect(result).toEqual([validOrgAuth.username, orgAuthScratchOrg.username]);
    });

    it('should filter out expired orgs by default', async () => {
      const expiredDate = new Date();
      expiredDate.setTime(expiredDate.getTime() - 60 * 60 * 1000); // 1 hour ago (expired)

      const expiredOrgAuth = {
        username: 'expired@example.com',
        orgId: 'expiredOrgId',
        oauthMethod: 'web' as const,
        isDevHub: false,
        aliases: [],
        configs: [],
        isExpired: false,
        error: undefined
      };

      const orgAuths = [validOrgAuth, expiredOrgAuth];
      getUsernameForMock.mockResolvedValueOnce(validOrgAuth.username);
      getUsernameForMock.mockResolvedValueOnce(expiredOrgAuth.username);
      getAuthFieldsForMock.mockResolvedValueOnce(validOrgAuth as AuthFields);
      getAuthFieldsForMock.mockResolvedValueOnce({
        ...validOrgAuth,
        expirationDate: expiredDate.toISOString()
      } as AuthFields);
      getDevHubUsernameMock.mockResolvedValueOnce(dummyDevHubUsername);
      getAllAliasesForMock.mockResolvedValue([]);

      const result = await orgList.filterAuthInfo(orgAuths);

      // Should only return the valid org, not the expired one
      expect(result).toEqual([validOrgAuth.username]);
    });

    it('should include expired orgs when showExpired is true', async () => {
      const expiredDate = new Date();
      expiredDate.setTime(expiredDate.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago (expired)

      const expiredOrgAuth = {
        username: 'expired@example.com',
        orgId: 'expiredOrgId',
        oauthMethod: 'web' as const,
        isDevHub: false,
        aliases: [],
        configs: [],
        isExpired: false,
        error: undefined
      };

      const orgAuths = [validOrgAuth, expiredOrgAuth];
      getUsernameForMock.mockResolvedValueOnce(validOrgAuth.username);
      getUsernameForMock.mockResolvedValueOnce(expiredOrgAuth.username);
      getAuthFieldsForMock.mockResolvedValueOnce(validOrgAuth as AuthFields);
      getAuthFieldsForMock.mockResolvedValueOnce({
        ...validOrgAuth,
        expirationDate: expiredDate.toISOString()
      } as AuthFields);
      getDevHubUsernameMock.mockResolvedValueOnce(dummyDevHubUsername);
      getAllAliasesForMock.mockResolvedValue([]);

      const result = await orgList.filterAuthInfo(orgAuths, true); // showExpired = true

      // Should return both orgs when showExpired is true
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(validOrgAuth.username);
      expect(result[1]).toContain('expired@example.com');
      expect(result[1]).toContain('Expired');
    });
  });

  describe('isOrgExpired', () => {
    afterEach(() => {
      jest.restoreAllMocks(); // Restore all mocks after each test
    });

    it('should return false if there is no expirationDate', async () => {
      getUsernameForMock.mockResolvedValue(orgAuth.username);
      getAuthFieldsForMock.mockResolvedValue({ expirationDate: undefined });

      const result = await orgList.isOrgExpired(orgAuthWithAlias.aliases![0]);

      expect(result).toBe(false);
      expect(getUsernameForMock).toHaveBeenCalledWith(orgAuthWithAlias.aliases![0]);
      expect(getAuthFieldsForMock).toHaveBeenCalledWith(orgAuth.username);
    });

    it('should return false if the expirationDate is in the future', async () => {
      getUsernameForMock.mockResolvedValue(orgAuthWithAlias.username);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // Set expiration date to tomorrow
      getAuthFieldsForMock.mockResolvedValue({
        expirationDate: futureDate.toISOString()
      });

      const result = await orgList.isOrgExpired(orgAuthWithAlias.aliases![0]);

      expect(result).toBe(false);
      expect(getUsernameForMock).toHaveBeenCalledWith(orgAuthWithAlias.aliases![0]);
      expect(getAuthFieldsForMock).toHaveBeenCalledWith(orgAuthWithAlias.username);
    });

    it('should return true if the expirationDate is in the past', async () => {
      getUsernameForMock.mockResolvedValue(orgAuthWithAlias.username);
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Set expiration date to yesterday
      getAuthFieldsForMock.mockResolvedValue({
        expirationDate: pastDate.toISOString()
      });

      const result = await orgList.isOrgExpired(orgAuthWithAlias.aliases![0]);

      expect(result).toBe(true);
      expect(getUsernameForMock).toHaveBeenCalledWith(orgAuthWithAlias.aliases![0]);
      expect(getAuthFieldsForMock).toHaveBeenCalledWith(orgAuthWithAlias.username);
    });
  });

  describe('displayTargetOrg tests', () => {
    let isOrgExpiredMock: jest.SpyInstance;
    let consoleErrorMock: jest.SpyInstance;

    beforeEach(() => {
      // Mock isOrgExpired method
      isOrgExpiredMock = jest.spyOn(OrgList.prototype, 'isOrgExpired');

      // Mock localization for missing org case
      jest.spyOn(nls, 'localize').mockReturnValue('No Default Org Set');
    });

    afterEach(() => {
      jest.restoreAllMocks(); // Restore mocks after each test
    });

    it('should display a warning icon when the org is expired', async () => {
      // Mock isOrgExpired to resolve to true (expired)
      isOrgExpiredMock.mockResolvedValue(true);

      // Call the method with a valid targetOrgOrAlias
      (orgList as any).displayTargetOrg('expired-org');

      // Wait for async promises to resolve
      await Promise.resolve();

      // Assert that the statusBarItem text is set to the warning icon with the org alias
      expect(mockStatusBarItem.text).toBe('$(warning) expired-org');
      expect(isOrgExpiredMock).toHaveBeenCalledWith('expired-org');
    });

    it('should display a plug icon when the org is not expired', async () => {
      // Mock isOrgExpired to resolve to false (not expired)
      isOrgExpiredMock.mockResolvedValue(false);

      // Call the method with a valid targetOrgOrAlias
      (orgList as any).displayTargetOrg('active-org');

      // Wait for async promises to resolve
      await Promise.resolve();

      // Assert that the statusBarItem text is set to the plug icon with the org alias
      expect(mockStatusBarItem.text).toBe('$(plug) active-org');
      expect(isOrgExpiredMock).toHaveBeenCalledWith('active-org');
    });

    it('should display an error icon when the org is not valid', async () => {
      const error = new Error('No authorization information found for invalid-org');
      error.name = 'NamedOrgNotFoundError';
      consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
      // Mock isOrgExpired to resolve to true (expired)
      isOrgExpiredMock.mockRejectedValue(error);

      // Call the method with a valid targetOrgOrAlias
      (orgList as any).displayTargetOrg('invalid-org');

      // Wait for async promises to resolve
      // eslint-disable-next-line jest/unbound-method
      await new Promise(process.nextTick);

      // Assert that the statusBarItem text is set to the error message
      expect(mockStatusBarItem.text).toBe(`$(error) ${nls.localize('invalid_default_org')}`);

      // Assert that the error is logged to the console
      expect(consoleErrorMock).toHaveBeenCalledWith('Error checking org expiration: ', error);

      // Clean up - restore the original console.error implementation
      consoleErrorMock.mockRestore();
    });

    it('should handle no org provided and display a localized message', () => {
      // Call the method without passing targetOrgOrAlias
      (orgList as any).displayTargetOrg();

      // Assert that the statusBarItem text is set to the localized missing org message
      expect(mockStatusBarItem.text).toBe(nls.localize('missing_default_org'));
      expect(nls.localize).toHaveBeenCalledWith('missing_default_org');
    });

    it('should handle errors during org expiration check', async () => {
      // Mock isOrgExpired to throw an error
      const error = new Error('Org expiration check failed');
      consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
      isOrgExpiredMock.mockRejectedValue(error);

      // Call the method with a valid targetOrgOrAlias
      (orgList as any).displayTargetOrg('error-org');

      // Wait for async promises to resolve
      await Promise.resolve();

      // Assert that the error is logged to the console
      expect(consoleErrorMock);
      // Clean up
      consoleErrorMock.mockRestore();
    });
  });

  describe('setDefaultOrg tests', () => {
    let showQuickPickMock: jest.SpyInstance;
    let executeCommandMock: jest.SpyInstance;

    beforeEach(() => {
      showQuickPickMock = jest.spyOn(vscode.window, 'showQuickPick');
      executeCommandMock = jest.spyOn(vscode.commands, 'executeCommand');
      // Mock getOrgAuthorizations to return an empty array to avoid dependency issues
      jest.spyOn(orgList, 'getOrgAuthorizations').mockResolvedValue([]);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe('Org picker SFDX commands', () => {
      it('should handle org login web authorization selection', async () => {
        showQuickPickMock.mockResolvedValueOnce(`$(plus) ${nls.localize('org_login_web_authorize_org_text')}`);

        const result = await orgList.setDefaultOrg();

        expect(result).toEqual({ type: 'CONTINUE', data: {} });
        expect(executeCommandMock).toHaveBeenCalledWith('sf.org.login.web');
      });

      it('should handle org login web dev hub authorization selection', async () => {
        showQuickPickMock.mockResolvedValueOnce(`$(plus) ${nls.localize('org_login_web_authorize_dev_hub_text')}`);

        const result = await orgList.setDefaultOrg();

        expect(result).toEqual({ type: 'CONTINUE', data: {} });
        expect(executeCommandMock).toHaveBeenCalledWith('sf.org.login.web.dev.hub');
      });

      it('should handle create default scratch org selection', async () => {
        showQuickPickMock.mockResolvedValueOnce(`$(plus) ${nls.localize('org_create_default_scratch_org_text')}`);

        const result = await orgList.setDefaultOrg();

        expect(result).toEqual({ type: 'CONTINUE', data: {} });
        expect(executeCommandMock).toHaveBeenCalledWith('sf.org.create');
      });

      it('should handle org login access token selection', async () => {
        showQuickPickMock.mockResolvedValueOnce(`$(plus) ${nls.localize('org_login_access_token_text')}`);

        const result = await orgList.setDefaultOrg();

        expect(result).toEqual({ type: 'CONTINUE', data: {} });
        expect(executeCommandMock).toHaveBeenCalledWith('sf.org.login.access.token');
      });

      it('should handle org list clean selection', async () => {
        showQuickPickMock.mockResolvedValueOnce(`$(plus) ${nls.localize('org_list_clean_text')}`);

        const result = await orgList.setDefaultOrg();

        expect(result).toEqual({ type: 'CONTINUE', data: {} });
        expect(executeCommandMock).toHaveBeenCalledWith('sf.org.list.clean');
      });

      it('should handle cancellation when no selection is made', async () => {
        showQuickPickMock.mockResolvedValueOnce(undefined);

        const result = await orgList.setDefaultOrg();

        expect(result).toEqual({ type: 'CANCEL' });
        expect(executeCommandMock).not.toHaveBeenCalled();
      });
    });

    it('should handle organization selection with simple alias', async () => {
      const orgSelection = 'MyOrg - user@example.com';
      showQuickPickMock.mockResolvedValueOnce(orgSelection);

      const result = await orgList.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'MyOrg');
    });

    it('should handle organization selection with alias containing dashes', async () => {
      const orgSelection = 'My Organization - Dev Sandbox - foo@bar.com';
      showQuickPickMock.mockResolvedValueOnce(orgSelection);

      const result = await orgList.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'My Organization - Dev Sandbox');
    });

    it('should handle organization selection with multiple dashes in alias', async () => {
      const orgSelection = 'Sales - Force - Dev - Hub - admin@company.com';
      showQuickPickMock.mockResolvedValueOnce(orgSelection);

      const result = await orgList.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'Sales - Force - Dev - Hub');
    });

    it('should handle organization selection with no alias (just username)', async () => {
      const orgSelection = 'user@example.com';
      showQuickPickMock.mockResolvedValueOnce(orgSelection);

      const result = await orgList.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'user@example.com');
    });

    it('should handle organization selection with comma-separated aliases', async () => {
      const orgSelection = 'alias1,alias2,alias3 - user@example.com';
      showQuickPickMock.mockResolvedValueOnce(orgSelection);

      const result = await orgList.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'alias1,alias2,alias3');
    });

    it('should handle organization selection with expired org indicator', async () => {
      const orgSelection = 'MyOrg - user@example.com - Expired ❌';
      showQuickPickMock.mockResolvedValueOnce(orgSelection);

      const result = await orgList.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'MyOrg');
    });

    it('should handle organization selection with complex alias and expired indicator', async () => {
      const orgSelection = 'My Organization - Dev Sandbox - user@example.com - Expired ❌';
      showQuickPickMock.mockResolvedValueOnce(orgSelection);

      const result = await orgList.setDefaultOrg();

      expect(result).toEqual({ type: 'CONTINUE', data: {} });
      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'My Organization - Dev Sandbox');
    });

    it('should handle org with alias containing dashes and expired indicator', async () => {
      showQuickPickMock.mockResolvedValueOnce('My Organization - Dev Sandbox - foo@bar.com - Expired ❌');

      const result = await orgList.setDefaultOrg();

      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'My Organization - Dev Sandbox');
      expect(result).toEqual({ type: 'CONTINUE', data: {} });
    });

    it('should handle org with no alias, just username and expired indicator', async () => {
      showQuickPickMock.mockResolvedValueOnce('admin@company.com - Expired ❌');

      const result = await orgList.setDefaultOrg();

      expect(executeCommandMock).toHaveBeenCalledWith('sf.config.set', 'admin@company.com');
      expect(result).toEqual({ type: 'CONTINUE', data: {} });
    });

    it('should handle complex aliases with dashes and multiple aliases', async () => {
      showQuickPickMock.mockResolvedValueOnce(
        'Sales - Force - Dev - Hub,Another - Complex - Alias,Simple Alias - admin@company.com'
      );

      const result = await orgList.setDefaultOrg();

      expect(executeCommandMock).toHaveBeenCalledWith(
        'sf.config.set',
        'Sales - Force - Dev - Hub,Another - Complex - Alias,Simple Alias'
      );
      expect(result).toEqual({ type: 'CONTINUE', data: {} });
    });

    it('should handle complex aliases with dashes and expired indicator', async () => {
      showQuickPickMock.mockResolvedValueOnce(
        'Sales - Force - Dev - Hub,Another - Complex - Alias - admin@company.com - Expired ❌'
      );

      const result = await orgList.setDefaultOrg();

      expect(executeCommandMock).toHaveBeenCalledWith(
        'sf.config.set',
        'Sales - Force - Dev - Hub,Another - Complex - Alias'
      );
      expect(result).toEqual({ type: 'CONTINUE', data: {} });
    });
  });
});
