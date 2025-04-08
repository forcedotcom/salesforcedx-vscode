/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { OrgType, workspaceContextUtils } from '../../../src/context';
import { DeployQueue, salesforceCoreSettings } from '../../../src/settings';

describe('DeployQueue', () => {
  describe('doDeploy', () => {
    let getPushOrDeployOnSaveEnabledMock: jest.SpyInstance;
    let getPreferDeployOnSaveEnabledMock: jest.SpyInstance;
    let getWorkspaceOrgTypeMock: jest.SpyInstance;
    let executeDeployCommandSpy: jest.SpyInstance;
    let executePushCommandSpy: jest.SpyInstance;
    let vscodeExecuteCommandSpy: jest.SpyInstance;

    beforeEach(() => {
      getPushOrDeployOnSaveEnabledMock = jest.spyOn(salesforceCoreSettings, 'getPushOrDeployOnSaveEnabled');
      getPreferDeployOnSaveEnabledMock = jest.spyOn(salesforceCoreSettings, 'getPreferDeployOnSaveEnabled');
      getWorkspaceOrgTypeMock = jest.spyOn(workspaceContextUtils, 'getWorkspaceOrgType');
      executeDeployCommandSpy = jest.spyOn((DeployQueue as any).prototype, 'executeDeployCommand');
      executePushCommandSpy = jest.spyOn((DeployQueue as any).prototype, 'executePushCommand');
      vscodeExecuteCommandSpy = jest.spyOn(vscode.commands, 'executeCommand');
    });

    afterEach(() => {
      DeployQueue.reset();
      jest.restoreAllMocks();
    });

    it('should execute a push command when org type is source-tracked, "Push or deploy on save" is enabled, and "Prefer deploy on save" is disabled', async () => {
      getWorkspaceOrgTypeMock.mockResolvedValue(OrgType.SourceTracked);
      getPushOrDeployOnSaveEnabledMock.mockReturnValue(true);
      getPreferDeployOnSaveEnabledMock.mockReturnValue(false);

      await DeployQueue.get().enqueue(vscode.Uri.file('/sample'));

      expect(getPreferDeployOnSaveEnabledMock).toHaveBeenCalled();
      expect(executePushCommandSpy).toHaveBeenCalled();
      expect(executeDeployCommandSpy).not.toHaveBeenCalled();
      expect(vscodeExecuteCommandSpy).toHaveBeenCalledWith('sf.project.deploy.start.ignore.conflicts', true);
    });

    it('should execute a deploy command when "Push or deploy on save" and "Prefer deploy on save" are enabled', async () => {
      getPushOrDeployOnSaveEnabledMock.mockReturnValue(true);
      getPreferDeployOnSaveEnabledMock.mockReturnValue(true);

      await DeployQueue.get().enqueue(vscode.Uri.file('/sample'));

      expect(getPreferDeployOnSaveEnabledMock).toHaveBeenCalled();
      expect(executePushCommandSpy).not.toHaveBeenCalled();
      expect(executeDeployCommandSpy).toHaveBeenCalled();
      expect(vscodeExecuteCommandSpy).toHaveBeenCalledWith('sf.deploy.multiple.source.paths', [undefined], null, true);
    });
  });
});
