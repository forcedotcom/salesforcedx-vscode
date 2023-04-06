import { WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import { WorkspaceContext, workspaceContextUtils } from '../../../src/context';

jest.mock('@salesforce/salesforcedx-utils-vscode');

describe('workspaceContext', () => {
  describe('handleCliConfigChange', () => {
    let setupWorkspaceOrgTypeMock: jest.SpyInstance;
    let workspaceContextUtilGetInstanceSpy: jest.SpyInstance;
    const mockWorkspaceContextUtil = { onOrgChange: jest.fn() };

    beforeEach(() => {
      setupWorkspaceOrgTypeMock = jest.spyOn(
        workspaceContextUtils,
        'setupWorkspaceOrgType'
      );
      workspaceContextUtilGetInstanceSpy = jest
        .spyOn(WorkspaceContextUtil, 'getInstance')
        .mockReturnValue(mockWorkspaceContextUtil as any);
    });

    it('should update context variables and UI elements when the config file changes', async () => {
      const c: any = WorkspaceContext.getInstance();
      await c.handleCliConfigChange({});
      expect(setupWorkspaceOrgTypeMock).toHaveBeenCalled();
    });
  });

  describe('setIsAScratchOrg', () => {
    it('should set the sfdx:is_a_scratch_org to true when connected to a scratch org', () => {});
    it('should set the sfdx:is_a_scratch_org to false when NOT connected to a scratch org', () => {});
  });
});
