import { SfProject } from '@salesforce/core';
import { ConfigUtil, workspaceUtils } from '../../../src';

describe('ConfigUtil', () => {
  describe('getProjectPackageNames', () => {
    const FAKE_WORKSPACE = '/here/is/a/fake/path/to/';
    const fakeProjects = ['project1', 'project2'];
    let getRootWorkspacePathStub: jest.SpyInstance;
    let getInstanceMock: jest.SpyInstance;
    let getUniquePackageNamesMock: jest.SpyInstance;

    beforeEach(() => {
      getRootWorkspacePathStub = jest
        .spyOn(workspaceUtils, 'getRootWorkspacePath')
        .mockReturnValue(FAKE_WORKSPACE);

      getUniquePackageNamesMock = jest.fn().mockReturnValue(fakeProjects);

      getInstanceMock = jest.spyOn(SfProject, 'getInstance').mockReturnValue({
        getUniquePackageNames: getUniquePackageNamesMock
      } as any);
    });

    it('should return project package directories listed in project config file', () => {
      const projectPackageNames = ConfigUtil.getProjectPackageNames();

      expect(getRootWorkspacePathStub).toHaveBeenCalled();
      expect(getInstanceMock).toHaveBeenCalledWith(FAKE_WORKSPACE);
      expect(getUniquePackageNamesMock).toHaveBeenCalled();
      expect(projectPackageNames).toEqual(fakeProjects);
    });
  });
});
