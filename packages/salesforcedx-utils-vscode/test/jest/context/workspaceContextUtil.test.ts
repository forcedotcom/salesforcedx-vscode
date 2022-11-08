/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import * as vscode from 'vscode';
import {  WorkspaceContextUtil } from '../../../src';

describe('WorkspaceContext', () => {
  const testUser = 'test@test.com';
  const testAlias = 'TestOrg';
  const testUser2 = 'test2@test.com';

  let getUsernameStub: jest.SpyInstance;
  let getUsernameOrAliasStub: jest.SpyInstance;
  let workspaceContextUtil: any; // TODO find a better way
  let authUtil: any;

  let mockWatcher: any;
  let mockFileSystemWatcher: jest.SpyInstance;

  beforeEach(async () => {
    mockWatcher = {
      onDidChange: jest.fn(),
      onDidCreate: jest.fn(),
      onDidDelete: jest.fn()
    };
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
      .spyOn(authUtil, 'getUsername')
      .mockReturnValue(testUser);

    await workspaceContextUtil.initialize(context);
  });

  it('test for the constructor', () => {
    expect(workspaceContextUtil).toHaveProperty('sessionConnections');
    expect(workspaceContextUtil).toHaveProperty('onOrgChangeEmitter');
    expect(workspaceContextUtil).toHaveProperty('cliConfigWatcher', mockWatcher);
  });
  it('should load the default username and alias upon initialization', () => {
    expect(workspaceContextUtil.username).toEqual(testUser);
    expect(workspaceContextUtil.alias).toEqual(testAlias);
  });

  it('should update default username and alias upon config change', async () => {
    getUsernameOrAliasStub.mockReturnValue(testUser2);
    getUsernameStub.mockReturnValue(testUser2);

    expect(mockWatcher.onDidChange).toHaveBeenCalled();
    const handler = mockWatcher.onDidChange.mock.calls[0][0];
    expect(handler).toBeInstanceOf(Function);
    await handler();

    expect(workspaceContextUtil.username).toEqual(testUser2);
    expect(workspaceContextUtil.alias).toEqual(undefined);
  });

  it('should update default username to undefined if username is not set', async () => {
    expect(workspaceContextUtil.username).toEqual(testUser);
    expect(workspaceContextUtil.alias).toEqual(testAlias);

    getUsernameStub.mockReturnValue(undefined);

    expect(mockWatcher.onDidChange).toHaveBeenCalled();
    const handler = mockWatcher.onDidChange.mock.calls[0][0];
    expect(handler).toBeInstanceOf(Function);
    await handler();

    expect(workspaceContextUtil.username).toEqual(undefined);
    expect(workspaceContextUtil.alias).toEqual(testAlias);
  });

  it('should update default username and alias to undefined if alias is not set', async () => {
    expect(workspaceContextUtil.username).toEqual(testUser);
    expect(workspaceContextUtil.alias).toEqual(testAlias);

    getUsernameOrAliasStub.mockReturnValue(undefined);

    expect(mockWatcher.onDidChange).toHaveBeenCalled();
    const handler = mockWatcher.onDidChange.mock.calls[0][0];
    expect(handler).toBeInstanceOf(Function);
    await handler();

    expect(workspaceContextUtil.username).toEqual(undefined);
    expect(workspaceContextUtil.alias).toEqual(undefined);
  });

  it('should notify subscribers that the default org may have changed', async () => {
    const someLogic = jest.fn();
    workspaceContextUtil.onOrgChange((orgInfo: any) => {
      someLogic(orgInfo);
    });

    // awaiting to ensure subscribers run their logic
    await mockWatcher.onDidChange.mock.calls[0][0]();
    await mockWatcher.onDidCreate.mock.calls[0][0]();
    await mockWatcher.onDidDelete.mock.calls[0][0]();

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
      createConnectionStub = jest
        .spyOn(Connection, 'create');
    });

    it('should return connection for the default org', async () => {
      createAuthStub.mockResolvedValue(mockAuthInfo);
      createConnectionStub.mockResolvedValue(mockConnection);
      const connection = await workspaceContextUtil.getConnection();
      expect(createConnectionStub).toHaveBeenCalledWith({ authInfo: mockAuthInfo });
      expect(connection).toEqual(mockConnection);
    });

    it('should return a cached connection for the default org if there is one', async () => {
      createAuthStub.mockReturnValue(mockAuthInfo);
      createConnectionStub.mockReturnValue(mockConnection);
      await workspaceContextUtil.getConnection();
      await workspaceContextUtil.getConnection();

      expect(createConnectionStub).toHaveBeenCalledTimes(1);
    });
  });
});
