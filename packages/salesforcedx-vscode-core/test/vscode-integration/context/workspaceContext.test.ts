/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { OrgUserInfo, WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import { join } from 'path';
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { SFDX_CONFIG_FILE, SFDX_FOLDER } from '../../../src/constants';
import { workspaceContextUtils } from '../../../src/context';
import { WorkspaceContext } from '../../../src/context/workspaceContext';
import { decorators } from '../../../src/decorators';
import { workspaceUtils } from '../../../src/util';

const env = createSandbox();

class MockFileWatcher implements vscode.Disposable {
  private watchUri: vscode.Uri;
  private changeSubscribers: ((uri: vscode.Uri) => void)[] = [];
  private createSubscribers: ((uri: vscode.Uri) => void)[] = [];
  private deleteSubscribers: ((uri: vscode.Uri) => void)[] = [];

  constructor(fsPath: string) {
    this.watchUri = vscode.Uri.file(fsPath);
  }

  public dispose() {}

  public onDidChange(f: (uri: vscode.Uri) => void): vscode.Disposable {
    this.changeSubscribers.push(f);
    return this;
  }

  public onDidCreate(f: (uri: vscode.Uri) => void): vscode.Disposable {
    this.createSubscribers.push(f);
    return this;
  }

  public onDidDelete(f: (uri: vscode.Uri) => void): vscode.Disposable {
    this.deleteSubscribers.push(f);
    return this;
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

  public ignoreCreateEvents = false;
  public ignoreChangeEvents = false;
  public ignoreDeleteEvents = false;
}

class TestWorkspaceContextUtil extends WorkspaceContextUtil {
  protected static testInstance: TestWorkspaceContextUtil;
  protected constructor() {
    super();

    const bindedHandler = () => this.handleCliConfigChange();
    const cliConfigPath = join(workspaceUtils.getRootWorkspacePath(), SFDX_FOLDER, SFDX_CONFIG_FILE);
    this.cliConfigWatcher = new MockFileWatcher(cliConfigPath);
    this.cliConfigWatcher.onDidChange(bindedHandler);
    this.cliConfigWatcher.onDidCreate(bindedHandler);
    this.cliConfigWatcher.onDidDelete(bindedHandler);
  }

  public static getInstance(forceNew = false) {
    if (!TestWorkspaceContextUtil.testInstance || forceNew) {
      TestWorkspaceContextUtil.testInstance = new TestWorkspaceContextUtil();
    }
    return TestWorkspaceContextUtil.testInstance;
  }

  public getFileWatcher(): MockFileWatcher {
    return this.cliConfigWatcher as MockFileWatcher;
  }
}

describe('WorkspaceContext', () => {
  const testUser = 'test@test.com';
  const testAlias = 'TestOrg';
  const testUser2 = 'test2@test.com';

  let setupWorkspaceOrgTypeStub: SinonStub;
  let usernameStub: SinonStub;
  let aliasStub: SinonStub;
  let showOrgStub: SinonStub;
  let workspaceContextUtil: WorkspaceContextUtil;
  let workspaceContext: WorkspaceContext;

  beforeEach(async () => {
    setupWorkspaceOrgTypeStub = env.stub(workspaceContextUtils, 'setupWorkspaceOrgType').resolves();

    workspaceContextUtil = TestWorkspaceContextUtil.getInstance();
    env.stub(WorkspaceContextUtil, 'getInstance').returns(workspaceContextUtil);
    usernameStub = env.stub(workspaceContextUtil, 'username').get(() => testUser);
    aliasStub = env.stub(workspaceContextUtil, 'alias').get(() => testAlias);
    showOrgStub = env.stub(decorators, 'showOrg').resolves();

    const extensionContext = {
      subscriptions: []
    } as unknown as vscode.ExtensionContext;

    workspaceContext = WorkspaceContext.getInstance(true);
    await workspaceContext.initialize(extensionContext);
  });

  afterEach(() => env.restore());

  it('should load the target org and alias upon initialization', () => {
    expect(workspaceContext.username).to.equal(testUser);
    expect(workspaceContext.alias).to.equal(testAlias);
    expect(setupWorkspaceOrgTypeStub.called).to.equal(true);
  });

  it('should update target org and alias upon config change', async () => {
    usernameStub.get(() => testUser2);
    aliasStub.get(() => undefined);

    await (workspaceContextUtil as TestWorkspaceContextUtil).getFileWatcher().fire('change');

    expect(setupWorkspaceOrgTypeStub.called).to.equal(true);
    expect(workspaceContext.username).to.equal(testUser2);
    expect(workspaceContext.alias).to.equal(undefined);
  });

  it('should update target org and alias to undefined if one is not set', async () => {
    usernameStub.get(() => undefined);
    aliasStub.get(() => undefined);

    await (workspaceContextUtil as TestWorkspaceContextUtil).getFileWatcher().fire('change');

    expect(setupWorkspaceOrgTypeStub.called).to.equal(true);
    expect(workspaceContext.username).to.equal(undefined);
    expect(workspaceContext.alias).to.equal(undefined);
  });

  // tslint:disable-next-line:only-arrow-functions
  it('should notify subscribers that the default org may have changed', async () => {
    const someLogic = env.stub();
    workspaceContext.onOrgChange((orgInfo: OrgUserInfo) => {
      someLogic(orgInfo);
    });

    // awaiting to ensure subscribers run their logic
    const fileChangedPromise = (workspaceContextUtil as TestWorkspaceContextUtil).getFileWatcher().fire('change');
    const fileCreatedPromise = (workspaceContextUtil as TestWorkspaceContextUtil).getFileWatcher().fire('create');
    const fileDeletedPromise = (workspaceContextUtil as TestWorkspaceContextUtil).getFileWatcher().fire('delete');

    // Test runs in CI build in approx: 45000ms
    await Promise.all([fileChangedPromise, fileCreatedPromise, fileDeletedPromise]);

    expect(someLogic.callCount).to.equal(3);
    expect(showOrgStub.called).to.equal(true);
  });

  describe('getConnection', () => {
    const mockAuthInfo = { test: 'test' };
    const mockConnection = { authInfo: mockAuthInfo };

    beforeEach(() => {
      env.stub(workspaceContextUtil, 'getConnection').returns(mockConnection);
    });

    it('should return connection for the default org', async () => {
      const connection = await workspaceContext.getConnection();

      expect(connection).to.deep.equal(mockConnection);
    });
  });
});
