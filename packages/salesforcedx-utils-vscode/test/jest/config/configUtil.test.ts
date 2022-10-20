import { ConfigUtil } from '../../../src';

describe('ConfigUtil', () => {
  describe('getProjectPackageNames', () => {
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

      const a = ConfigUtil.getProjectPackageNames();

      expect(a).toEqual('');
    });
  });
});
