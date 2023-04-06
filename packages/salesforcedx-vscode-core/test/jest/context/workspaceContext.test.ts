import { WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import { WorkspaceContext, workspaceContextUtils } from '../../../src/context';
import { log } from 'console';
// import { getWorkspaceOrgType } from '../../../src/context/workspaceOrgType';

jest.mock('../../../src/context/workspaceOrgType', () => {
  return {
    ...jest.requireActual('../../../src/context/workspaceOrgType')
    // getWorkspaceOrgType: jest.fn()
  };
});

jest.mock('@salesforce/salesforcedx-utils-vscode');
jest.mock('../../../src/context/workspaceOrgType');

describe('workspaceContext', () => {
  describe('handleCliConfigChange', () => {
    let setupWorkspaceOrgTypeMock: jest.SpyInstance;
    let workspaceContextUtilGetInstanceSpy: jest.SpyInstance;
    let setIsScratchOrgSpy: jest.SpyInstance;
    // let getWorkspaceOrgTypeMock: jest.SpyInstance;

    const mockWorkspaceContextUtil = {
      onOrgChange: jest.fn(),
      getConnection: jest.fn(),
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

      setIsScratchOrgSpy = jest.spyOn(
        (WorkspaceContext as any).prototype,
        'setIsScratchOrg'
      );

      // getWorkspaceOrgTypeMock = jest.spyOn(
      //   getWorkspaceOrgType,
      //   'getWorkspaceOrgType'
      // );
    });

    it('should update context variables and UI elements when the config file changes', async () => {
      const c: any = WorkspaceContext.getInstance();
      try {
        await c.handleCliConfigChange({});
      } catch (error) {
        console.log('error: ' + error);
      }
      expect(setupWorkspaceOrgTypeMock).toHaveBeenCalled();
      expect(setIsScratchOrgSpy).toHaveBeenCalled();
    });
  });

  describe('setIsAScratchOrg', () => {
    it('should set the sfdx:is_a_scratch_org to true when connected to a scratch org', () => {});
    it('should set the sfdx:is_a_scratch_org to false when NOT connected to a scratch org', () => {});
  });
});
