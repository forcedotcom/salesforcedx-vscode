import * as sinon from 'sinon';
import * as vscode from 'vscode';

describe('Should synchronize init jobs in server by default', () => {
  const sandbox = sinon.createSandbox();
  beforeEach(() => {
    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => true
    });
  });

  afterEach(() => sandbox.restore());

  it('should enable enableSynchronizedInitJobs by default', () => {
    const enableSyncInitJobs: boolean = vscode.workspace
      .getConfiguration()
      .get<boolean>('salesforcedx-vscode-apex.wait-init-jobs', false);

    expect(enableSyncInitJobs).toBe(true);
  });

  it('value of enableSynchronizedInitJobs should be updated after changed', () => {
    sandbox.restore();
    sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => false
    });
    const enableSyncInitJobs: boolean = vscode.workspace
      .getConfiguration()
      .get<boolean>('salesforcedx-vscode-apex.wait-init-jobs', true);

    expect(enableSyncInitJobs).toBe(false);
  });
});
