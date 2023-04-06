import { Org } from '@salesforce/core';
import { WorkspaceContext } from '../../../src/context';
import {
  getWorkspaceOrgType,
  OrgType
} from '../../../src/context/workspaceOrgType';

describe('workspaceOrgType', () => {
  describe('getWorkspaceOrgType', () => {
    const mockWorkspaceContext = { getConnection: jest.fn() } as any;
    let workspaceContextGetInstanceSpy: jest.SpyInstance;
    let orgStub: jest.SpyInstance;

    beforeEach(() => {
      workspaceContextGetInstanceSpy = jest
        .spyOn(WorkspaceContext, 'getInstance')
        .mockReturnValue(mockWorkspaceContext);
    });

    it('should return SourceTracked for an org that supports source-tracking', async () => {
      orgStub = jest.spyOn(Org, 'create').mockResolvedValue({
        supportsSourceTracking: async () => true
      } as any);

      const orgType = await getWorkspaceOrgType();

      expect(workspaceContextGetInstanceSpy).toHaveBeenCalled();
      expect(orgType).toEqual(OrgType.SourceTracked);
    });

    it('should return NonSourceTracked for an org that does not support source-tracking', async () => {
      orgStub = jest.spyOn(Org, 'create').mockResolvedValue({
        supportsSourceTracking: async () => false
      } as any);

      const orgType = await getWorkspaceOrgType();

      expect(workspaceContextGetInstanceSpy).toHaveBeenCalled();
      expect(orgType).toEqual(OrgType.NonSourceTracked);
    });
  });
});
