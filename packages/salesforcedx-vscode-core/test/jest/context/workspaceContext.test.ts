/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import { WorkspaceContext, workspaceContextUtils } from '../../../src/context';
import * as contextVariables from '../../../src/context/contextVariables';
import { decorators } from '../../../src/decorators';

describe('workspaceContext', () => {
  let setupWorkspaceOrgTypeMock: jest.SpyInstance;
  let workspaceContextUtilGetInstanceSpy: jest.SpyInstance;
  let setIsScratchOrgSpy: jest.SpyInstance;
  let decoratorsMock: jest.SpyInstance;

  const mockWorkspaceContextUtil = {
    onOrgChange: jest.fn(),
    getConnection: jest.fn().mockResolvedValue({}),
    setupWorkspaceOrgType: jest.fn()
  };

  beforeEach(() => {
    setupWorkspaceOrgTypeMock = jest.spyOn(
      workspaceContextUtils,
      'setupWorkspaceOrgType'
    );
    workspaceContextUtilGetInstanceSpy = jest
      .spyOn(WorkspaceContextUtil, 'getInstance')
      .mockReturnValue(mockWorkspaceContextUtil as any);
  });

  describe('handleCliConfigChange', () => {
    beforeEach(() => {
      setIsScratchOrgSpy = jest.spyOn(contextVariables, 'setIsScratchOrg');
      decoratorsMock = jest.spyOn(decorators, 'showOrg');
    });

    it('should update context variables and UI elements when the config file changes', async () => {
      const workspaceContext = WorkspaceContext.getInstance();
      await (workspaceContext as any).handleCliConfigChange({
        username: 'test@test.com'
      });

      expect(setupWorkspaceOrgTypeMock).toHaveBeenCalled();
      expect(setIsScratchOrgSpy).toHaveBeenCalled();
      expect(decoratorsMock).toHaveBeenCalled();
    });
  });
});
