import { AuthInfo, Connection } from '@salesforce/core';
import { expect } from 'chai';
import { join } from 'path';
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { SFDX_CONFIG_FILE, SFDX_FOLDER } from '../../../src/constants';
import * as wsContext from '../../../src/context';
import { TelemetryService } from '../../../src/telemetry/telemetry';
import { getRootWorkspacePath, OrgAuthInfo } from '../../../src/util';

const { WorkspaceContext } = wsContext;

const env = createSandbox();

class MockFileWatcher {
  private watchUri: vscode.Uri;
  private changeSubscribers: Array<(uri: vscode.Uri) => void> = [];
  private createSubscribers: Array<(uri: vscode.Uri) => void> = [];
  private deleteSubscribers: Array<(uri: vscode.Uri) => void> = [];

  constructor(fsPath: string) {
    this.watchUri = vscode.Uri.file(fsPath);
  }

  public onDidChange(f: (uri: vscode.Uri) => void) {
    this.changeSubscribers.push(f);
  }

  public onDidCreate(f: (uri: vscode.Uri) => void) {
    this.createSubscribers.push(f);
  }

  public onDidDelete(f: (uri: vscode.Uri) => void) {
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

describe('WorkspaceContext', () => {
  const testUser = 'test@test.com';
  const testAlias = 'TestOrg';
  const testUser2 = 'test2@test.com';
  const cliConfigPath = join(
    getRootWorkspacePath(),
    SFDX_FOLDER,
    SFDX_CONFIG_FILE
  );
  let mockFileWatcher: MockFileWatcher;

  let orgTypeStub: SinonStub;
  let getUsernameStub: SinonStub;
  let getUsernameOrAliasStub: SinonStub;

  beforeEach(async () => {
    mockFileWatcher = new MockFileWatcher(cliConfigPath);

    env
      .stub(vscode.workspace, 'createFileSystemWatcher')
      .withArgs(cliConfigPath)
      .returns(mockFileWatcher);
    orgTypeStub = env.stub(wsContext, 'setupWorkspaceOrgType').resolves();
    getUsernameOrAliasStub = env
      .stub(OrgAuthInfo, 'getDefaultUsernameOrAlias')
      .returns(testAlias);
    getUsernameStub = env
      .stub(OrgAuthInfo, 'getUsername')
      .withArgs(testAlias)
      .returns(testUser);

    const context = ({
      subscriptions: []
    } as unknown) as vscode.ExtensionContext;

    await WorkspaceContext.initialize(context);
  });

  afterEach(() => env.restore());

  it('should load the default username and alias upon initialization', () => {
    expect(WorkspaceContext.get().orgUsername).to.equal(testUser);
    expect(WorkspaceContext.get().orgAlias).to.equal(testAlias);
    expect(orgTypeStub.called).to.equal(true);
  });

  it('should update default username and alias upon config change', async () => {
    getUsernameOrAliasStub.returns(testUser2);
    getUsernameStub.withArgs(testUser2).returns(testUser2);

    await mockFileWatcher.fire('change');

    expect(orgTypeStub.called).to.equal(true);
    expect(WorkspaceContext.get().orgUsername).to.equal(testUser2);
    expect(WorkspaceContext.get().orgAlias).to.equal(undefined);
  });

  describe('subscribe', () => {
    const someLogic = env.stub();

    class TestSubscriber implements wsContext.OrgSubscriber {
      public async onOrgChange(username?: string, alias?: string) {
        someLogic(username, alias);
      }
    }

    afterEach(() => someLogic.reset());

    it('should notify subscribers that the default org may have changed', async () => {
      WorkspaceContext.get().subscribe(new TestSubscriber());

      // awaiting to validate that subscriber implementations were called
      await mockFileWatcher.fire('change');
      await mockFileWatcher.fire('create');
      await mockFileWatcher.fire('delete');

      expect(someLogic.callCount).to.equal(3);
    });

    it('should notify a subscriber upon subscribing if notifyNow is true', () => {
      WorkspaceContext.get().subscribe(new TestSubscriber(), true);

      expect(someLogic.callCount).to.equal(1);
    });

    it('should log exception if subscriber throws an error', () => {
      const sendExceptionStub = env.stub(
        TelemetryService.getInstance(),
        'sendException'
      );
      const error = new Error('waah');
      class SadSubscriber implements wsContext.OrgSubscriber {
        public async onOrgChange(username?: string, alias?: string) {
          throw error;
        }
      }

      WorkspaceContext.get().subscribe(new SadSubscriber(), true);

      process.nextTick(() => {
        expect(sendExceptionStub.getCall(0).args).to.deep.equal([
          'WorkspaceContextError',
          'Error in callback for subscriber SadSubscriber: waah'
        ]);
      });
    });
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
      const connection = await WorkspaceContext.get().getConnection();

      expect(connection).to.deep.equal(mockConnection);
    });

    it('should return a cached connection for the default org if there is one', async () => {
      await WorkspaceContext.get().getConnection();
      await WorkspaceContext.get().getConnection();

      expect(createConnectionStub.callCount).to.equal(1);
    });
  });
});
