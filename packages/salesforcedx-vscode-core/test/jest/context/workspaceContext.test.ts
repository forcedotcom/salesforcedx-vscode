/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { OrgUserInfo, WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { WorkspaceContext, workspaceContextUtils } from '../../../src/context';
import { decorators } from '../../../src/decorators';
import { OrgAuthInfo } from '../../../src/util/authInfo';

jest.mock('../../../src/util/authInfo', () => ({
  OrgAuthInfo: {
    getDevHubIdFromScratchOrg: jest.fn()
  }
}));

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

  describe('handleOrgShapeChange', () => {
    jest.mock('../../../src/context', () => ({
      workspaceContextUtils: {
        getOrgShape: jest.fn(),
        OrgShape: {
          Undefined: 'Undefined',
          Scratch: 'Scratch',
          Sandbox: 'Sandbox',
          Production: 'Production'
        }
      }
    }));

    const mockOrgUserInfo: OrgUserInfo = { username: 'test-username' };
    let workspaceContextUtilGetInstanceSpy: jest.SpyInstance;
    let getOrgShapeMock: jest.SpyInstance;
    let getDevHubIdFromScratchOrgMock: jest.SpyInstance;
    const mockWorkspaceContextUtil = {
      onOrgChange: jest.fn(),
      orgShape: undefined,
      devHubId: undefined,
      username: 'mock-username',
      alias: 'mock-alias',
      orgId: 'mock-org-id',
      getConnection: jest.fn().mockResolvedValue({
        getAuthInfoFields: jest.fn().mockReturnValue({ orgId: '000' })
      })
    };

    beforeEach(() => {
      jest.clearAllMocks();
      workspaceContextUtilGetInstanceSpy = jest
        .spyOn(WorkspaceContextUtil, 'getInstance')
        .mockReturnValue(mockWorkspaceContextUtil as any);

      getOrgShapeMock = jest.spyOn(workspaceContextUtils, 'getOrgShape').mockResolvedValue('Undefined');

      getDevHubIdFromScratchOrgMock = jest.spyOn(OrgAuthInfo, 'getDevHubIdFromScratchOrg');
    });

    it('should set orgShape and devHubId to undefined if orgShape is Undefined', async () => {
      getOrgShapeMock.mockResolvedValue('Undefined');
      const workspaceContext = WorkspaceContext.getInstance();

      await (workspaceContext as any).handleOrgShapeChange(mockOrgUserInfo);

      expect(getOrgShapeMock).toHaveBeenCalledWith(mockOrgUserInfo.username);
      expect(mockWorkspaceContextUtil.orgShape).toBeUndefined();
      expect(mockWorkspaceContextUtil.devHubId).toBeUndefined();
    });

    it('should set orgShape if it is not Undefined and not set devHubId if not Scratch', async () => {
      getOrgShapeMock.mockResolvedValue('Sandbox');
      const workspaceContext = WorkspaceContext.getInstance();

      await (workspaceContext as any).handleOrgShapeChange(mockOrgUserInfo);

      expect(workspaceContextUtilGetInstanceSpy).toHaveBeenCalled();
      expect(getOrgShapeMock).toHaveBeenCalledWith(mockOrgUserInfo.username);
      expect(mockWorkspaceContextUtil.orgShape).toBe('Sandbox');
      expect(mockWorkspaceContextUtil.devHubId).toBeUndefined();
    });

    it('should set orgShape and devHubId if orgShape is Scratch', async () => {
      getOrgShapeMock.mockResolvedValue('Scratch');
      getDevHubIdFromScratchOrgMock.mockResolvedValue('test-dev-hub-id');
      const workspaceContext = WorkspaceContext.getInstance();

      await (workspaceContext as any).handleOrgShapeChange(mockOrgUserInfo);

      expect(workspaceContextUtilGetInstanceSpy).toHaveBeenCalled();
      expect(getOrgShapeMock).toHaveBeenCalledWith(mockOrgUserInfo.username);
      expect(mockWorkspaceContextUtil.orgShape).toBe('Scratch');
      expect(getDevHubIdFromScratchOrgMock).toHaveBeenCalledWith(mockOrgUserInfo.username);
      expect(mockWorkspaceContextUtil.devHubId).toBe('test-dev-hub-id');
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
