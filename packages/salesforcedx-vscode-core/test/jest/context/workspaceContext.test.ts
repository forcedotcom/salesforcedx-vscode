/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { OrgUserInfo, OrgShape, WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import { WorkspaceContext, workspaceContextUtils } from '../../../src/context';

const getDevHubIdFromScratchOrgMock = jest.fn();
jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  ...jest.requireActual('@salesforce/salesforcedx-utils-vscode'),
  getDevHubIdFromScratchOrg: (...args: any[]) => getDevHubIdFromScratchOrgMock(...args)
}));

const mockRunPromise = jest.fn();
jest.mock('../../../src/services/runtime', () => ({
  getRuntime: () => ({ runPromise: mockRunPromise })
}));

describe('workspaceContext', () => {
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

    const mockWorkspaceContextUtil = {
      onOrgChange: jest.fn(),
      orgShape: undefined as OrgShape | undefined,
      devHubId: undefined as string | undefined,
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

      getDevHubIdFromScratchOrgMock.mockResolvedValue(undefined);
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

  describe('initialization promise logic', () => {
    let mockWorkspaceContextUtil: any;
    let mockExtensionContext: any;
    const mockConnection = { getAuthInfoFields: () => ({ orgId: '000' }) };

    beforeEach(() => {
      jest.clearAllMocks();
      mockWorkspaceContextUtil = {
        onOrgChange: jest.fn(),
        initialize: jest.fn().mockResolvedValue(undefined)
      };
      jest.spyOn(WorkspaceContextUtil, 'getInstance').mockReturnValue(mockWorkspaceContextUtil);
      mockRunPromise.mockResolvedValue(mockConnection);

      mockExtensionContext = {
        extension: { id: 'salesforce.salesforcedx-vscode-core' },
        subscriptions: []
      };
    });

    it('should store initialization promise on first initialize() call', async () => {
      const workspaceContext = WorkspaceContext.getInstance(true);

      const promise = workspaceContext.initialize(mockExtensionContext);

      expect(promise).toBeInstanceOf(Promise);
      await promise;
      expect(mockWorkspaceContextUtil.initialize).toHaveBeenCalledTimes(1);
    });

    it('should only initialize once on multiple initialize() calls', async () => {
      const workspaceContext = WorkspaceContext.getInstance(true);

      const promise1 = workspaceContext.initialize(mockExtensionContext);
      const promise2 = workspaceContext.initialize(mockExtensionContext);
      const promise3 = workspaceContext.initialize(mockExtensionContext);

      await Promise.all([promise1, promise2, promise3]);

      expect(mockWorkspaceContextUtil.initialize).toHaveBeenCalledTimes(1);
    });

    it('should delegate getConnection() to the services runtime', async () => {
      const workspaceContext = WorkspaceContext.getInstance(true);

      const conn = await workspaceContext.getConnection();

      expect(conn).toBe(mockConnection);
      expect(mockRunPromise).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple concurrent getConnection() calls', async () => {
      const workspaceContext = WorkspaceContext.getInstance(true);

      const [conn1, conn2, conn3] = await Promise.all([
        workspaceContext.getConnection(),
        workspaceContext.getConnection(),
        workspaceContext.getConnection()
      ]);

      expect(conn1).toBe(mockConnection);
      expect(conn2).toBe(mockConnection);
      expect(conn3).toBe(mockConnection);
      expect(mockRunPromise).toHaveBeenCalledTimes(3);
    });
  });
});
