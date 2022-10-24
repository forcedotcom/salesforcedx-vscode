import * as path from 'path';
import { projectPaths, workspaceUtils } from '../../../src/';

jest.mock('@salesforce/core', () => {
  return {
    Global: {
      SFDX_STATE_FOLDER: '.sfdx'
    }
  };
});

describe('test project paths', () => {
  const FAKE_WORKSPACE = '/here/is/a/fake/path/to/';

  describe('test stateFolder', () => {
    const FAKE_STATE_FOLDER = '.sfdx';
    let getRootWorkspacePathStub: jest.SpyInstance;
    const hasRootWorkspaceStub = jest.spyOn(workspaceUtils, 'hasRootWorkspace');

    beforeEach(() => {
      getRootWorkspacePathStub = jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue(FAKE_WORKSPACE);
    });

    it('should be defined', () => {
      expect(projectPaths.stateFolder).toBeDefined();
    });

    it('should return a path to the state folder if the project has a root workspace', () => {
      hasRootWorkspaceStub.mockReturnValue(true);
      expect(projectPaths.stateFolder()).toEqual(path.join(FAKE_WORKSPACE, FAKE_STATE_FOLDER));
    });

    it('should return a path to the state folder if the project does not have a root workspace', () => {
      hasRootWorkspaceStub.mockReturnValue(false);
      expect(projectPaths.stateFolder()).toEqual('');
    });

  });
  describe('test sfdxProjectConfig', () => {
    let stateFolderStub: jest.SpyInstance;
    const FAKE_CONFIG = path.join(FAKE_WORKSPACE, 'sfdx-config.json');

    beforeEach(() => {
      stateFolderStub = jest.spyOn(projectPaths, 'stateFolder').mockReturnValue(FAKE_WORKSPACE);
    });

    it('should be defined', () => {
      expect(projectPaths.sfdxProjectConfig).toBeDefined();
    });

    it('should return a path to the config file based on root workspace', () => {
      const sfdxProjectConfig = projectPaths.sfdxProjectConfig();
      expect(sfdxProjectConfig).toEqual(FAKE_CONFIG);
    });
  });

});
