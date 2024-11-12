/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { WorkspaceContext, workspaceContextUtils } from '../../../src/context';
import { decorators } from '../../../src/decorators';

describe('workspaceContext', () => {
  describe('handleCliConfigChange', () => {
    const mockWorkspaceContextUtil = {
      onOrgChange: jest.fn(),
      getConnection: jest.fn().mockResolvedValue({
        getAuthInfoFields: () => {
          return { orgId: '000' };
        }
      })
    };
    let workspaceContextUtilGetInstanceSpy: jest.SpyInstance;
    let setupWorkspaceOrgTypeMock: jest.SpyInstance;
    let decoratorsMock: jest.SpyInstance;
    let createStatusBarItemMock: jest.SpyInstance;
    const mockStatusBarItem: any = {};

    beforeEach(() => {
      workspaceContextUtilGetInstanceSpy = jest
        .spyOn(WorkspaceContextUtil, 'getInstance')
        .mockReturnValue(mockWorkspaceContextUtil as any);
      setupWorkspaceOrgTypeMock = jest.spyOn(workspaceContextUtils, 'setupWorkspaceOrgType').mockResolvedValue();
      decoratorsMock = jest.spyOn(decorators, 'showOrg');
      createStatusBarItemMock = vscode.window.createStatusBarItem as jest.Mock;
    });

    it('should update context variables and UI elements when the config file changes', async () => {
      mockStatusBarItem.tooltip = '';
      mockStatusBarItem.command = '';
      mockStatusBarItem.text = '';
      mockStatusBarItem.show = jest.fn();
      mockStatusBarItem.dispose = jest.fn();
      createStatusBarItemMock.mockReturnValue(mockStatusBarItem);
      const workspaceContext = WorkspaceContext.getInstance();
      await (workspaceContext as any).handleCliConfigChange({
        username: 'test@test.com'
      });

      expect(workspaceContextUtilGetInstanceSpy).toHaveBeenCalled();
      expect(setupWorkspaceOrgTypeMock).toHaveBeenCalled();
      expect(decoratorsMock).toHaveBeenCalled();
    });
  });

  describe('orgId', () => {
    const dummyOrgId = '000dummyOrgId';
    let getInstanceMock: jest.SpyInstance;

    beforeEach(() => {
      getInstanceMock = jest.spyOn(WorkspaceContextUtil, 'getInstance').mockReturnValue({
        orgId: dummyOrgId
      } as any);
    });

    it('should get the orgId from WorkspaceContextUtil', () => {
      const orgId = WorkspaceContext.getInstance().orgId;

      expect(getInstanceMock).toHaveBeenCalled();
      expect(orgId).not.toBeNull();
    });
  });
});
