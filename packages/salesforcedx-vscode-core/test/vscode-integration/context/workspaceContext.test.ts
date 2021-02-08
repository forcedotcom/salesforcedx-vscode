import { AuthInfo, Connection } from '@salesforce/core';
import { OrgInfo, WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode/out/src';
import { expect } from 'chai';
import { join } from 'path';
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { SFDX_CONFIG_FILE, SFDX_FOLDER } from '../../../src/constants';
import * as wsContext from '../../../src/context';
import { WorkspaceContext } from '../../../src/context/workspaceContext';
import { getRootWorkspacePath, OrgAuthInfo } from '../../../src/util';

const env = createSandbox();

class MockFileWatcher implements vscode.Disposable {
  private watchUri: vscode.Uri;
  private changeSubscribers: Array<(uri: vscode.Uri) => void> = [];
  private createSubscribers: Array<(uri: vscode.Uri) => void> = [];
  private deleteSubscribers: Array<(uri: vscode.Uri) => void> = [];

  constructor(fsPath: string) {
    this.watchUri = vscode.Uri.file(fsPath);
  }

  public dispose() { }

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
    const cliConfigPath = join(getRootWorkspacePath(), SFDX_FOLDER, SFDX_CONFIG_FILE);
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

  public getFileWatcher(): MockFileWatcher { return this.cliConfigWatcher as MockFileWatcher; }
}

describe('WorkspaceContext', () => {
  const testUser = 'test@test.com';
  const testAlias = 'TestOrg';
  const testUser2 = 'test2@test.com';
  const cliConfigPath = join(
    getRootWorkspacePath(),
    SFDX_FOLDER,
    SFDX_CONFIG_FILE
  );

  let orgTypeStub: SinonStub;
  let usernameStub: SinonStub;
  let aliasStub: SinonStub;
  let workspaceContextUtil: WorkspaceContextUtil;
  let workspaceContext: WorkspaceContext;

  beforeEach(async () => {
    orgTypeStub = env.stub(wsContext, 'setupWorkspaceOrgType').resolves();

    workspaceContextUtil = TestWorkspaceContextUtil.getInstance();
    env.stub(WorkspaceContextUtil, 'getInstance').returns(workspaceContextUtil);
    usernameStub = env.stub(workspaceContextUtil, 'username').get(() => testUser);
    aliasStub = env.stub(workspaceContextUtil, 'alias').get(() => testAlias);

    const context = ({
      subscriptions: []
    } as unknown) as vscode.ExtensionContext;

    workspaceContext = WorkspaceContext.getInstance(true);
    await workspaceContext.initialize(context);
  });

  afterEach(() => env.restore());

  it('should load the default username and alias upon initialization', () => {
    expect(workspaceContext.username).to.equal(testUser);
    expect(workspaceContext.alias).to.equal(testAlias);
    expect(orgTypeStub.called).to.equal(true);
  });

  it('should update default username and alias upon config change', async () => {
    usernameStub.get(() => testUser2);
    aliasStub.get(() => undefined);

    await (workspaceContextUtil as TestWorkspaceContextUtil).getFileWatcher().fire('change');

    expect(orgTypeStub.called).to.equal(true);
    expect(workspaceContext.username).to.equal(testUser2);
    expect(workspaceContext.alias).to.equal(undefined);
  });

  it('should update default username and alias to undefined if one is not set', async () => {
    usernameStub.get(() => undefined);
    aliasStub.get(() => undefined);

    await (workspaceContextUtil as TestWorkspaceContextUtil).getFileWatcher().fire('change');

    expect(orgTypeStub.called).to.equal(true);
    expect(workspaceContext.username).to.equal(undefined);
    expect(workspaceContext.alias).to.equal(undefined);
  });

  it('should notify subscribers that the default org may have changed', async () => {
    const someLogic = env.stub();
    workspaceContext.onOrgChange((orgInfo: wsContext.OrgInfo) => {
      someLogic(orgInfo);
    });

    // awaiting to ensure subscribers run their logic
    await (workspaceContextUtil as TestWorkspaceContextUtil).getFileWatcher().fire('change');
    await (workspaceContextUtil as TestWorkspaceContextUtil).getFileWatcher().fire('create');
    await (workspaceContextUtil as TestWorkspaceContextUtil).getFileWatcher().fire('delete');

    expect(someLogic.callCount).to.equal(3);
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
