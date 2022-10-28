import * as path from 'path';
import { projectPaths, workspaceUtils } from '../../../src/';

jest.mock('@salesforce/core', () => {
  return {
    Global: {
      SFDX_STATE_FOLDER: '.sfdx',
      STATE_FOLDER: '.sfdx'
    }
  };
});

describe('test project paths', () => {
  const hasRootWorkspaceStub = jest.spyOn(workspaceUtils, 'hasRootWorkspace');
  const FAKE_HOME_DIR = '/fake/home/dir/';
  const FAKE_WORKSPACE = '/here/is/a/fake/path/to/';
  const FAKE_STATE_FOLDER = '.sfdx';
  const FAKE_CONFIG_FILE = 'sfdx-config.json';
  const FAKE_PATH = path.join(FAKE_WORKSPACE, FAKE_STATE_FOLDER);

  describe('test stateFolder', () => {
    let getRootWorkspacePathStub: jest.SpyInstance;

    beforeEach(() => {
      getRootWorkspacePathStub = jest
        .spyOn(workspaceUtils, 'getRootWorkspacePath')
        .mockReturnValue(FAKE_WORKSPACE);
    });

    it('should be defined', () => {
      expect(projectPaths.stateFolder).toBeDefined();
    });

    it('should return a path to the state folder if the project has a root workspace', () => {
      hasRootWorkspaceStub.mockReturnValue(true);
      expect(projectPaths.stateFolder()).toEqual(
        path.join(FAKE_PATH)
      );
    });

    it('should return a path to the state folder if the project does not have a root workspace', () => {
      hasRootWorkspaceStub.mockReturnValue(false);
      expect(projectPaths.stateFolder()).toEqual('');
    });
  });
  describe('test sfdxProjectConfig', () => {
    let stateFolderStub: jest.SpyInstance;
    const FAKE_CONFIG = path.join(FAKE_WORKSPACE, FAKE_CONFIG_FILE);

    beforeEach(() => {
      stateFolderStub = jest
        .spyOn(projectPaths, 'stateFolder')
        .mockReturnValue(FAKE_WORKSPACE);
    });

    it('should be defined', () => {
      expect(projectPaths.sfdxProjectConfig).toBeDefined();
    });

    it('should return a path to the config file based on root workspace', () => {
      const sfdxProjectConfig = projectPaths.sfdxProjectConfig();
      expect(sfdxProjectConfig).toEqual(FAKE_CONFIG);
    });
  });

  describe('test relativeStateFolder', () => {
    it('should be defined', () => {
      expect(projectPaths.relativeStateFolder).toBeDefined();
    });

    it('should return a path to the relative state folder', () => {
      const relativeStateFolder = projectPaths.relativeStateFolder();
      expect(relativeStateFolder).toEqual(FAKE_STATE_FOLDER);
    });
  });

  describe('test SFDXGlobalConfigPath', () => {
    it('should return the global config path', () => {
      const mockOS = jest.requireActual('os');
      mockOS.homedir = jest.fn().mockReturnValue(FAKE_HOME_DIR);
      jest.mock('os', () => mockOS);
      const result = projectPaths.sfdxGlobalConfig();
      expect(result).toEqual(path.join(FAKE_HOME_DIR, FAKE_STATE_FOLDER, FAKE_CONFIG_FILE)
      );
    });
  });

  describe('test SFDXConfigPath', () => {

    it('should be defined', () => {
      expect(projectPaths.sfdxConfig).toBeDefined();
    });

    it('should return a path to the project config file when in a project workspace', () => {
      const FAKE_CONFIG = path.join(FAKE_PATH, FAKE_CONFIG_FILE);
      hasRootWorkspaceStub.mockReturnValue(true);
      let stateFolderStub: jest.SpyInstance;
      stateFolderStub = jest
        .spyOn(projectPaths, 'stateFolder')
        .mockReturnValue(FAKE_PATH);

      const sfdxConfig = projectPaths.sfdxConfig();
      expect(sfdxConfig).toEqual(FAKE_CONFIG);
    });

    it('should return a path to the global config file when not in a project workspace', () => {
      const mockOS = jest.requireActual('os');
      mockOS.homedir = jest.fn().mockReturnValue(FAKE_HOME_DIR);
      jest.mock('os', () => mockOS);

      const sfdxConfig = projectPaths.sfdxConfig();
      expect(sfdxConfig).toEqual(path.join(FAKE_HOME_DIR, FAKE_STATE_FOLDER, FAKE_CONFIG_FILE));
    });
  });
});
