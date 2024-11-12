/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Org } from '@salesforce/core-bundle';
import { WorkspaceContext } from '../../../src/context';
import { getWorkspaceOrgType, OrgType } from '../../../src/context/workspaceOrgType';

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
