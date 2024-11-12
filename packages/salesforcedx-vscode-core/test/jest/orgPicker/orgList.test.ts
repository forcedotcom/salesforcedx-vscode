/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthFields, OrgAuthorization, StateAggregator } from '@salesforce/core-bundle';
import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { nls } from '../../../src/messages';
import { OrgList } from '../../../src/orgPicker';
import { OrgAuthInfo } from '../../../src/util';

describe('OrgList tests', () => {
  let orgList: OrgList;
  let createFileSystemWatcherMock: jest.SpyInstance;
  let createStatusBarItemMock: jest.SpyInstance;
  let getDevHubUsernameMock: jest.SpyInstance;
  let getAllMock: jest.SpyInstance;
  let getAllAliasesForMock: jest.SpyInstance;
  let getUsernameForMock: jest.SpyInstance;
  let getAuthFieldsForMock: jest.SpyInstance;
  let stateAggregatorCreateMock: jest.SpyInstance;
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
    createFileSystemWatcherMock = (vscode.workspace.createFileSystemWatcher as any).mockReturnValue(mockWatcher);
    createStatusBarItemMock = (vscode.window.createStatusBarItem as jest.Mock).mockReturnValue(mockStatusBarItem);
    orgList = new OrgList();
    getAuthFieldsForMock = jest.spyOn(OrgList.prototype, 'getAuthFieldsFor');
    getUsernameForMock = jest.spyOn(ConfigUtil, 'getUsernameFor');
    getDevHubUsernameMock = jest.spyOn(OrgAuthInfo, 'getDevHubUsername');
    getAllMock = jest.fn();
    fakeStateAggregator = {
      aliases: {
        getAll: getAllMock
      }
    };
    stateAggregatorCreateMock = jest.spyOn(StateAggregator, 'create').mockResolvedValue(fakeStateAggregator);
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
});
