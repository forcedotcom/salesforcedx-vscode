import * as vscode from 'vscode';

describe('Should synchronize init jobs in server by default', () => {
  beforeEach(() => {

  });

  afterEach(() => {

  });

  it('should enable enableSynchronizedInitJobs by default', () => {
    const enableSyncInitJobs: boolean = vscode.workspace
      .getConfiguration()
      .get<boolean>('salesforcedx-vscode-apex.wait-init-jobs', false);

    expect(enableSyncInitJobs).toBe(true);
  });
});
