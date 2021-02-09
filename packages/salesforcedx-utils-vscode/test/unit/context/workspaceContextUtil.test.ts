/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { expect } from 'chai';
import { join } from 'path';
import * as proxyquire from 'proxyquire';
import { createSandbox, SinonStub, stub } from 'sinon';

class EventEmitter {
  private listeners: any[] = [];
  constructor() { }
  public event = (listener: any) => this.listeners.push(listener);
  public dispose = stub();
  public fire = (e: any) => this.listeners.forEach(listener => listener(e));
}

const vscodeStub = {
  commands: stub(),
  Disposable: stub(),
  env: {
    machineId: '12345534'
  },
  EventEmitter,
  Uri: {
    parse: stub(),
    file: stub()
  },
  window: {
    showInformationMessage: stub()
  },
  workspace: {
    createFileSystemWatcher: () => {
      return {
        dispose: () => { },
        onDidChange: () => { },
        onDidCreate: () => { },
        onDidDelete: () => { },
        fire: () => { }
      };
    },
    getConfiguration: () => {
      return {
        get: () => true
      };
    },
    onDidChangeConfiguration: stub()
  }
};

export class MockFileWatcher {
  private watchUri: any;
  private changeSubscribers: Array<(uri: any) => void> = [];
  private createSubscribers: Array<(uri: any) => void> = [];
  private deleteSubscribers: Array<(uri: any) => void> = [];

  constructor(fsPath: string) {
    this.watchUri = vscodeStub.Uri.file(fsPath);
  }

  public dispose() { }

  public onDidChange(f: (uri: any) => void) {
    this.changeSubscribers.push(f);
  }

  public onDidCreate(f: (uri: any) => void) {
    this.createSubscribers.push(f);
  }

  public onDidDelete(f: (uri: any) => void) {
    this.deleteSubscribers.push(f);
  }

  public async fire(type: 'change' | 'create' | 'delete') {
    let subscribers;

    switch (type) {
      case 'change':
        subscribers = this.changeSubscribers;
        break;
      case 'create':
        subscribers = this.createSubscribers;
        break;
      case 'delete':
        subscribers = this.deleteSubscribers;
        break;
    }

    for (const subscriber of subscribers) {
      await subscriber(this.watchUri);
    }
  }
}

const { WorkspaceContextUtil } = proxyquire.noCallThru()(
  '../../../src/index',
  {
    vscode: vscodeStub
  }
);

const env = createSandbox();

describe('WorkspaceContext', () => {
  const testUser = 'test@test.com';
  const testAlias = 'TestOrg';
  const testUser2 = 'test2@test.com';
  const cliConfigPath = join(
    '/user/dev',
    '.sfdx',
    'sfdx-config.json'
  );
  let mockFileWatcher: MockFileWatcher;

  let getUsernameStub: SinonStub;
  let getUsernameOrAliasStub: SinonStub;
  let workspaceContextUtil: any;
  let authUtil: any;

  beforeEach(async () => {
    mockFileWatcher = new MockFileWatcher(cliConfigPath);

    env
      .stub(vscodeStub.workspace, 'createFileSystemWatcher')
      .returns(mockFileWatcher);

    const context = {
      subscriptions: []
    };

    workspaceContextUtil = WorkspaceContextUtil.getInstance(true);

    authUtil = workspaceContextUtil.getAuthUtil();
    getUsernameOrAliasStub = env
      .stub(authUtil, 'getDefaultUsernameOrAlias')
      .returns(testAlias);
    getUsernameStub = env
      .stub(authUtil, 'getUsername')
      .withArgs(testAlias)
      .returns(testUser);

    await workspaceContextUtil.initialize(context);
  });

  afterEach(() => env.restore());

  it('should load the default username and alias upon initialization', () => {
    expect(workspaceContextUtil.username).to.equal(testUser);
    expect(workspaceContextUtil.alias).to.equal(testAlias);
  });

  it('should update default username and alias upon config change', async () => {
    getUsernameOrAliasStub.returns(testUser2);
    getUsernameStub.withArgs(testUser2).returns(testUser2);

    await mockFileWatcher.fire('change');

    expect(workspaceContextUtil.username).to.equal(testUser2);
    expect(workspaceContextUtil.alias).to.equal(undefined);
  });

  it('should update default username and alias to undefined if one is not set', async () => {
    getUsernameOrAliasStub.returns(undefined);
    getUsernameStub.returns(undefined);

    await mockFileWatcher.fire('change');

    expect(workspaceContextUtil.username).to.equal(undefined);
    expect(workspaceContextUtil.alias).to.equal(undefined);
  });

  it('should notify subscribers that the default org may have changed', async () => {
    const someLogic = env.stub();
    workspaceContextUtil.onOrgChange((orgInfo: any) => {
      someLogic(orgInfo);
    });

    // awaiting to ensure subscribers run their logic
    await mockFileWatcher.fire('change');
    await mockFileWatcher.fire('create');
    await mockFileWatcher.fire('delete');

    expect(someLogic.callCount).to.equal(3);
  });

  describe('getConnection', () => {
    const mockAuthInfo = { test: 'test' };
    const mockConnection = { authInfo: mockAuthInfo };

    let createConnectionStub: SinonStub;

    beforeEach(() => {
      env
        .stub(AuthInfo, 'create')
        .withArgs({ username: testUser })
        .resolves(mockAuthInfo);
      createConnectionStub = env
        .stub(Connection, 'create')
        .withArgs({ authInfo: mockAuthInfo })
        .returns(mockConnection);
    });

    it('should return connection for the default org', async () => {
      const connection = await workspaceContextUtil.getConnection();

      expect(connection).to.deep.equal(mockConnection);
    });

    it('should return a cached connection for the default org if there is one', async () => {
      await workspaceContextUtil.getConnection();
      await workspaceContextUtil.getConnection();

      expect(createConnectionStub.callCount).to.equal(1);
    });
  });
});
