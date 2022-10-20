import { SfProject } from '@salesforce/core';
import { ConfigUtil, workspaceUtils } from '../../../src';

describe('ConfigUtil', () => {
  describe('getProjectPackageNames', () => {
    const mockSfProject: any = {
      getUniquePackageNames: jest.fn()
    };
    const sfProjectGetInstanceMock = jest.fn();
    const FAKE_WORKSPACE = '/here/is/a/fake/path/to/';
    let getRootWorkspacePathStub: jest.SpyInstance;

    beforeEach(() => {
      SfProject.getInstance = sfProjectGetInstanceMock;
      jest
        .spyOn(SfProject.prototype, 'getUniquePackageNames')
        .mockImplementation(() => ['project1', 'project2']);

      getRootWorkspacePathStub = jest
        .spyOn(workspaceUtils, 'getRootWorkspacePath')
        .mockReturnValue(FAKE_WORKSPACE);
    });

    it('should return project package directories listed in project config file', () => {
      // In this test I want to assert that
      // 1. getRootWorkspace was called first
      // 2. SfProject.getInstance() was called, passing the value from getRootWorkspace
      // 3. getUniquePackageNames() was called last
      // I don't want to test the response from getUniquePackageNames()
      // since that is already tested in the core lib here: https://github.com/forcedotcom/sfdx-core/blob/4b6f99b44b77989fc525460391b41da62deb62a8/test/unit/projectTest.ts#L516

      sfProjectGetInstanceMock.mockReturnValue(mockSfProject);

      const projectPackageNames = ConfigUtil.getProjectPackageNames();

      expect(getRootWorkspacePathStub).toHaveBeenCalled();
      expect(sfProjectGetInstanceMock).toHaveBeenCalled();
      expect(mockSfProject.getUniquePackageNames).toHaveBeenCalled();
    });
  });
});
