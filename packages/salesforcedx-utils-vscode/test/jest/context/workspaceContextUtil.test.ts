/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection, StateAggregator } from '@salesforce/core';
import * as vscode from 'vscode';
import { ConfigAggregatorProvider, WorkspaceContextUtil } from '../../../src';
import { ConfigUtil } from '../../../src/config/configUtil';
import { nls } from '../../../src/messages';
jest.mock('@salesforce/core');
jest.mock('../../../src/config/configUtil');

const authInfoMock = jest.mocked(AuthInfo);
const connectionMock = jest.mocked(Connection);
const configUtilMock = jest.mocked(ConfigUtil);

describe('WorkspaceContextUtil', () => {
  const testUser = 'test@test.com';
  const testAlias = 'TestOrg';
  const testUser2 = 'test2@test.com';
  const dummyOrgId = '000dummyOrgId';
  const dummyOrgId2 = '000dummyOrgId2';
  const context = {
    subscriptions: []
  };

  let getUsernameStub: jest.SpyInstance;
  let getConnectionMock: jest.SpyInstance;
  let getUsernameOrAliasStub: jest.SpyInstance;
  let workspaceContextUtil: any; // TODO find a better way

  let mockWatcher: { onDidChange: any; onDidCreate: any; onDidDelete: any };
  let mockFileSystemWatcher: jest.SpyInstance;
  let reloadConfigAggregatorsMock: jest.SpyInstance;
  let stateAggregatorClearInstanceMock: jest.SpyInstance;

  beforeEach(async () => {
    mockWatcher = {
      onDidChange: jest.fn(),
      onDidCreate: jest.fn(),
      onDidDelete: jest.fn()
    };
    reloadConfigAggregatorsMock = jest.spyOn(
      ConfigAggregatorProvider.prototype,
      'reloadConfigAggregators'
    );
    stateAggregatorClearInstanceMock = jest.spyOn(
      StateAggregator,
      'clearInstance'
    );

    mockFileSystemWatcher = (vscode.workspace
      .createFileSystemWatcher as any).mockReturnValue(mockWatcher);

    getUsernameOrAliasStub = (configUtilMock.getDefaultUsernameOrAlias as any).mockReturnValue(testAlias);
    getUsernameStub = (configUtilMock.getUsernameFor as any).mockReturnValue(testUser);

    workspaceContextUtil = WorkspaceContextUtil.getInstance(true);

    getConnectionMock = jest.spyOn(workspaceContextUtil, 'getConnection');

    await workspaceContextUtil.initialize(context);
    (workspaceContextUtil as any)._username = testUser;
  });

  it('test for the constructor', () => {
    expect(workspaceContextUtil).toHaveProperty('sessionConnections');
    expect(workspaceContextUtil).toHaveProperty('onOrgChangeEmitter');
    expect(workspaceContextUtil).toHaveProperty(
      'cliConfigWatcher',
      mockWatcher
    );
  });

  it('should return workspace context util instance', () => {
    expect(WorkspaceContextUtil.getInstance(false)).toEqual(
      workspaceContextUtil
    );
  });

  it('should load the default username, alias, and orgId and clear the cache of the core types upon initialization', async () => {
    getConnectionMock.mockReturnValue({
      getAuthInfoFields: () => {
        return { orgId: dummyOrgId };
      }
    });

    // Re-initialize the workspaceContextUtil instance so that it re- sets _orgId
    await workspaceContextUtil.initialize(context);

    expect(workspaceContextUtil.username).toEqual(testUser);
    expect(workspaceContextUtil.alias).toEqual(testAlias);
    expect(workspaceContextUtil.orgId).toEqual(dummyOrgId);
    expect(reloadConfigAggregatorsMock).toHaveBeenCalled();
    expect(stateAggregatorClearInstanceMock).toHaveBeenCalled();
  });

  it('should set _orgId to an empty string and log a message if there was a problem getting the connection', async () => {
    const dummyErrorMessage = 'There was a problem getting the connection.';
    const logMock = jest.spyOn(console, 'log');

    // Arrange
    getConnectionMock.mockRejectedValueOnce(new Error(dummyErrorMessage));

    // Act
    await workspaceContextUtil.initialize(context);

    // Assert
    expect(workspaceContextUtil.username).toEqual(testUser);
    expect(workspaceContextUtil.alias).toEqual(testAlias);
    expect(workspaceContextUtil.orgId).toEqual('');
    expect(logMock.mock.calls[0][0].includes(dummyErrorMessage)).toBe(true);
  });

  it('should update default username, alias, and orgId and clear the cache of the core types upon config change', async () => {
    getConnectionMock.mockReturnValue({
      getAuthInfoFields: () => {
        return { orgId: dummyOrgId2 };
      }
    });

    getUsernameOrAliasStub.mockReturnValue(testUser2);
    getUsernameStub.mockReturnValue(testUser2);

    expect(mockWatcher.onDidChange).toHaveBeenCalled();
    const handler = mockWatcher.onDidChange.mock.calls[0][0];
    expect(handler).toBeInstanceOf(Function);
    await handler();

    expect(workspaceContextUtil.username).toEqual(testUser2);
    expect(workspaceContextUtil.alias).toEqual(undefined);
    expect(workspaceContextUtil.orgId).toEqual(dummyOrgId2);
    expect(reloadConfigAggregatorsMock).toHaveBeenCalled();
    expect(stateAggregatorClearInstanceMock).toHaveBeenCalled();
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

  it('should return the _orgId property', () => {
    // Arrange
    (workspaceContextUtil as any)._orgId = dummyOrgId;

    // Act/Assert
    expect(workspaceContextUtil.orgId).toEqual(dummyOrgId);
  });

  describe('getConnection', () => {
    const mockAuthInfo = { test: 'test' };
    const mockConnection = { authInfo: mockAuthInfo };

    let createAuthStub: jest.SpyInstance;
    let createConnectionStub: jest.SpyInstance;

    beforeEach(() => {
      createAuthStub = jest.spyOn(AuthInfo, 'create');
      createConnectionStub = jest.spyOn(Connection, 'create');
    });

    it('should return connection for the default org', async () => {
      authInfoMock.create.mockResolvedValue(mockAuthInfo as any);
      authInfoMock.create.mockResolvedValue(mockAuthInfo as any);
      connectionMock.create.mockResolvedValue(
        (mockConnection as unknown) as Promise<Connection<any>>
      );
      const connection = await workspaceContextUtil.getConnection();
      expect(connectionMock.create).toHaveBeenCalledWith({
        authInfo: mockAuthInfo
      });
      expect(connection).toEqual(mockConnection);
    });

    it('should return a cached connection for the default org if there is one', async () => {
      authInfoMock.create.mockResolvedValue(mockAuthInfo as any);
      connectionMock.create.mockResolvedValue(
        (mockConnection as unknown) as Promise<Connection<any>>
      );
      await workspaceContextUtil.getConnection();
      await workspaceContextUtil.getConnection();

      expect(connectionMock.create).toHaveBeenCalledTimes(2);
    });

    it('should not throw error if there is a username set', async () => {
      const connection = await workspaceContextUtil.getConnection();
      expect(() => connection).not.toThrow();
    });

    it('should throw error if there is no username set', async () => {
      // Arrange
      const message = nls.localize('error_no_default_username');
      workspaceContextUtil = WorkspaceContextUtil.getInstance(true);

      // Act/Assert
      await expect(async () => {
        await workspaceContextUtil.getConnection();
      }).rejects.toThrowError(message);
    });
  });
});
