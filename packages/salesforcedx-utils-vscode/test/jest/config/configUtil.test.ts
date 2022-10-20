import { SfProject } from '@salesforce/core';
import { getRootWorkspacePath } from '@salesforce/salesforcedx-utils-vscode';
import { ConfigUtil } from '../../../src';
// jest.mock('SfProject');

describe('ConfigUtil', () => {
  describe('getProjectPackageNames', () => {
    // let sut: SfProject;
    const mockSfProject: any = {
      getUniquePackageNames: jest.fn()
    };
    const mockStaticMethod = jest.fn();
    const mockStaticMethod2 = jest.fn();

    beforeEach(() => {
      // assign the mock jest.fn() to static method
      SfProject.getInstance = mockStaticMethod;
      SfProject.prototype.getUniquePackageNames = mockStaticMethod2;
      // sut = new TestClass();
    });

    it('should return project package directories listed in project config file', () => {
      // Need to stub:
      // getRootWorkspacePath
      // SfProject.getInstance()
      // project.getUniquePackageNames()

      // In this test I want to assert that
      // 1. getRootWorkspace was called first
      // 2. SfProject.getInstance() was called, passing the value from getRootWorkspace
      // 3. getUniquePackageNames() was called last
      // I don't want to test the response from getUniquePackageNames()
      // since that is already tested in the core lib here: https://github.com/forcedotcom/sfdx-core/blob/4b6f99b44b77989fc525460391b41da62deb62a8/test/unit/projectTest.ts#L516

      // const mockSfProject: SfProject = jest.createMockFromModule('SfProject');

      // SfProject.getInstance = jest.fn(path => secret === 'not wizard');

      mockStaticMethod.mockReturnValue(mockSfProject);
      mockStaticMethod2.mockReturnValue('test');

      const a = ConfigUtil.getProjectPackageNames();

      expect(getRootWorkspacePath).toHaveBeenCalled();
    });
  });
});
