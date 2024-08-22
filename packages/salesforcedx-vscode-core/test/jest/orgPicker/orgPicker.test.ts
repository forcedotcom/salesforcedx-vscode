/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthFields, OrgAuthorization } from '@salesforce/core-bundle';
import * as vscode from 'vscode';
import { OrgList } from '../../../src/orgPicker';
import { OrgAuthInfo } from '../../../src/util';

describe('OrgList - filterAuthInfo', () => {
  let orgList: OrgList;
  let createFileSystemWatcherMock: jest.SpyInstance;
  let getDevHubUsernameMock: jest.SpyInstance;
  let getAuthFieldsForMock: jest.SpyInstance;
  let mockWatcher: any;

  const dummyDevHubUsername = 'test-devhub@example.com';

  const createOrgAuthorization = (
    overrides: Partial<OrgAuthorization> = {}
  ): OrgAuthorization => ({
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

  beforeEach(() => {
    mockWatcher = {
      onDidChange: jest.fn(),
      onDidCreate: jest.fn(),
      onDidDelete: jest.fn()
    };
    createFileSystemWatcherMock = (
      vscode.workspace.createFileSystemWatcher as any
    ).mockReturnValue(mockWatcher);
    (vscode.window.createStatusBarItem as jest.Mock).mockReturnValue({
      command: '',
      text: '',
      tooltip: '',
      show: jest.fn(),
      dispose: jest.fn()
    });
    orgList = new OrgList();
    getAuthFieldsForMock = jest.spyOn(OrgList.prototype, 'getAuthFieldsFor');
    getDevHubUsernameMock = jest.spyOn(OrgAuthInfo, 'getDevHubUsername');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should filter out orgs with the scratchAdminUsername field', async () => {
    const orgAuth = createOrgAuthorization();
    const orgAuths = [orgAuth];
    getAuthFieldsForMock.mockResolvedValueOnce({
      scratchAdminUsername: 'admin@example.com'
    } as AuthFields);
    getDevHubUsernameMock.mockResolvedValueOnce(null);

    const result = await orgList.filterAuthInfo(orgAuths);

    expect(result).toEqual([]);
  });

  it('should filter out scratch orgs parented by non-default Dev Hubs', async () => {
    const orgAuth = createOrgAuthorization({ isScratchOrg: true });
    const orgAuths = [orgAuth];
    getAuthFieldsForMock.mockResolvedValueOnce({
      devHubUsername: 'other-devhub@example.com'
    } as AuthFields);
    getDevHubUsernameMock.mockResolvedValueOnce(dummyDevHubUsername);

    const result = await orgList.filterAuthInfo(orgAuths);

    expect(result).toEqual([]);
  });

  it('should filter out expired orgs', async () => {
    const expiredOrgAuth = createOrgAuthorization({
      username: 'expired-org@example.com',
      isExpired: true
    });
    const orgAuths = [expiredOrgAuth];
    getAuthFieldsForMock.mockResolvedValueOnce({} as AuthFields);
    getDevHubUsernameMock.mockResolvedValueOnce(dummyDevHubUsername);

    const result = await orgList.filterAuthInfo(orgAuths);

    expect(result).toEqual([]);
  });

  it('should include aliases in the result if available', async () => {
    const orgAuth = createOrgAuthorization({
      username: 'test-username@example.com',
      aliases: ['alias1']
    });
    const orgAuths = [orgAuth];
    getAuthFieldsForMock.mockResolvedValueOnce({} as AuthFields);
    getDevHubUsernameMock.mockResolvedValueOnce(null);

    const result = await orgList.filterAuthInfo(orgAuths);

    expect(result).toEqual(['alias1 - test-username@example.com']);
  });

  it('should filter out org authorizations with errors', async () => {
    const orgAuthWithError = createOrgAuthorization({
      username: 'error-org@example.com',
      error: 'Some error'
    });
    const orgAuths = [orgAuthWithError];
    getAuthFieldsForMock.mockResolvedValueOnce({} as AuthFields);
    getDevHubUsernameMock.mockResolvedValueOnce(null);

    const result = await orgList.filterAuthInfo(orgAuths);

    expect(result).toEqual([]);
  });

  it('should return a list of valid org authorizations', async () => {
    const validOrgAuth = createOrgAuthorization({
      username: 'valid-org@example.com'
    });
    const orgAuths = [validOrgAuth];
    getAuthFieldsForMock.mockResolvedValueOnce({} as AuthFields);
    getDevHubUsernameMock.mockResolvedValueOnce(dummyDevHubUsername);

    const result = await orgList.filterAuthInfo(orgAuths);

    expect(result).toEqual(['valid-org@example.com']);
  });
});
