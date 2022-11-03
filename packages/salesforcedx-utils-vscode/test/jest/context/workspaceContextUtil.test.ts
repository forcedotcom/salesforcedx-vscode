/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { create } from 'domain';
import { join } from 'path';
import * as vscode from 'vscode';
import {  WorkspaceContextUtil } from '../../../src';

describe('WorkspaceContext', () => {
  const testUser = 'test@test.com';
  const testAlias = 'TestOrg';
  const testUser2 = 'test2@test.com';
  const cliConfigPath = join('/user/dev', '.sfdx', 'sfdx-config.json');

  let getUsernameStub: jest.SpyInstance;
  let getUsernameOrAliasStub: jest.SpyInstance;
  let workspaceContextUtil: any; // TODO find a better way
  let authUtil: any;

  const mockWatcher = {
    onDidChange: jest.fn(),
    onDidCreate: jest.fn(),
    onDidDelete: jest.fn()
  };
  let mockFileSystemWatcher: jest.SpyInstance;

  beforeEach(async () => {
    mockFileSystemWatcher = (vscode.workspace
      .createFileSystemWatcher as any).mockReturnValue(mockWatcher);

    const context = {
      subscriptions: []
    };

    workspaceContextUtil = WorkspaceContextUtil.getInstance(true);

    authUtil = workspaceContextUtil.getAuthUtil();
    getUsernameOrAliasStub = jest
      .spyOn(authUtil, 'getDefaultUsernameOrAlias')
      .mockReturnValue(testAlias);
    getUsernameStub = jest
      .spyOn(authUtil, 'getUsername');

    await workspaceContextUtil.initialize(context);
  });
  it('test for the constructor', () => {
    expect(workspaceContextUtil).toHaveProperty('sessionConnections');
    expect(workspaceContextUtil).toHaveProperty('onOrgChangeEmitter');
    expect(workspaceContextUtil).toHaveProperty('cliConfigWatcher', mockWatcher);
  });
  it('should load the default username and alias upon initialization', () => {
    getUsernameStub.mockReturnValue(testUser);
    expect(getUsernameStub).toHaveBeenCalledWith(testAlias);
    expect(workspaceContextUtil.username).toEqual(testUser);
    expect(workspaceContextUtil.alias).toEqual(testAlias);
  });

  it('should update default username and alias upon config change', async () => {
    getUsernameOrAliasStub.mockReturnValue(testUser2);
    getUsernameStub.mockReturnValue(testUser2);
    expect(getUsernameStub).toHaveBeenCalledWith(testUser2);

    await mockWatcher.onDidChange();

    expect(workspaceContextUtil.username).toEqual(testUser2);
    expect(workspaceContextUtil.alias).toEqual(undefined);
  });

  it('should update default username and alias to undefined if one is not set', async () => {
    getUsernameOrAliasStub.mockReturnValue(undefined);
    getUsernameStub.mockReturnValue(undefined);

    await mockWatcher.onDidChange();

    expect(workspaceContextUtil.username).toEqual(undefined);
    expect(workspaceContextUtil.alias).toEqual(undefined);
  });

  it('should notify subscribers that the default org may have changed', async () => {
    const someLogic = jest.fn();
    workspaceContextUtil.onOrgChange((orgInfo: any) => {
      someLogic(orgInfo);
    });

    // awaiting to ensure subscribers run their logic
    await mockWatcher.onDidChange();
    await mockWatcher.onDidCreate();
    await mockWatcher.onDidDelete();

    expect(someLogic).toHaveBeenCalledTimes(3);
  });

  describe('getConnection', () => {
    const mockAuthInfo = { test: 'test' };
    const mockConnection = { authInfo: mockAuthInfo };

    let createAuthStub: jest.SpyInstance;
    let createConnectionStub: jest.SpyInstance;

    beforeEach(() => {
      createAuthStub = jest
        .spyOn(AuthInfo, 'create');
        // .mockResolvedValue(mockAuthInfo);
      createConnectionStub = jest
        .spyOn(Connection, 'create');
        // .mockResolvedValue(mockConnection);
    });

    it('should return connection for the default org', async () => {
      createAuthStub.mockResolvedValue(mockAuthInfo);
      createConnectionStub.mockResolvedValue(mockConnection);
      const connection = await workspaceContextUtil.getConnection();
      expect(createConnectionStub).toHaveBeenCalledWith({ authInfo: mockAuthInfo });
      expect(connection).toEqual(mockConnection);
    });

    it('should return a cached connection for the default org if there is one', async () => {
      await workspaceContextUtil.getConnection();
      await workspaceContextUtil.getConnection();

      expect(createConnectionStub).toHaveBeenCalledTimes(1);
    });
  });
});
