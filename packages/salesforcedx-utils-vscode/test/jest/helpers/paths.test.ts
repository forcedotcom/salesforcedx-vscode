/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import * as vscode from 'vscode';
import { WorkspaceContextUtil } from '../../../src';
import { fileExtensionsMatch, projectPaths, workspaceUtils } from '../../../src/';
import {
  APEX,
  APEX_DB,
  DEBUG,
  LOGS,
  LWC,
  METADATA,
  ORGS,
  SFDX_CONFIG_FILE,
  TEST_RESULTS,
  TOOLS
} from '../../../src/helpers/paths';

jest.mock('@salesforce/core-bundle', () => {
  return {
    Global: {
      SFDX_STATE_FOLDER: '.sfdx',
      STATE_FOLDER: '.sfdx'
    }
  };
});

jest.mock('@salesforce/source-tracking-bundle', () => {
  return {};
});

describe('test project paths', () => {
  const hasRootWorkspaceStub = jest.spyOn(workspaceUtils, 'hasRootWorkspace');
  const FAKE_WORKSPACE = '/here/is/a/fake/path/to/';
  const FAKE_WORKSPACE_INSTANCE: any = {};
  const FAKE_STATE_FOLDER = '.sfdx';
  const FAKE_PATH_TO_STATE_FOLDER = path.join(FAKE_WORKSPACE, FAKE_STATE_FOLDER);

  describe('test stateFolder', () => {
    let getRootWorkspacePathStub: jest.SpyInstance;

    beforeEach(() => {
      getRootWorkspacePathStub = jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue(FAKE_WORKSPACE);
    });

    it('should return a path to the state folder if the project has a root workspace', () => {
      hasRootWorkspaceStub.mockReturnValue(true);
      expect(projectPaths.stateFolder()).toEqual(FAKE_PATH_TO_STATE_FOLDER);
    });

    it('should return a path to the state folder if the project does not have a root workspace', () => {
      hasRootWorkspaceStub.mockReturnValue(false);
      expect(projectPaths.stateFolder()).toEqual('');
    });
  });
  describe('test salesforceProjectConfig', () => {
    let stateFolderStub: jest.SpyInstance;
    const FAKE_CONFIG = path.join(FAKE_WORKSPACE, SFDX_CONFIG_FILE);

    beforeEach(() => {
      stateFolderStub = jest.spyOn(projectPaths, 'stateFolder').mockReturnValue(FAKE_WORKSPACE);
    });

    it('should be defined', () => {
      expect(projectPaths.salesforceProjectConfig).toBeDefined();
    });

    it('should return a path to the config file based on root workspace', () => {
      const salesforceProjectConfig = projectPaths.salesforceProjectConfig();
      expect(salesforceProjectConfig).toEqual(FAKE_CONFIG);
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

  describe('test relativeToolsFolder', () => {
    it('should be defined', () => {
      expect(projectPaths.relativeToolsFolder).toBeDefined();
    });

    it('should return a path to the relative tools folder', () => {
      const relativeToolsFolder = projectPaths.relativeToolsFolder();
      expect(relativeToolsFolder).toEqual(path.join(FAKE_STATE_FOLDER, TOOLS));
    });
  });

  describe('test toolsFolder', () => {
    let stateFolderStub: jest.SpyInstance;

    beforeEach(() => {
      stateFolderStub = jest.spyOn(projectPaths, 'stateFolder').mockReturnValue(FAKE_WORKSPACE);
    });
    it('should be defined', () => {
      expect(projectPaths.toolsFolder).toBeDefined();
    });

    it('should return a path to the tools folder based on root workspace', () => {
      const toolsFolder = projectPaths.toolsFolder();
      expect(toolsFolder).toEqual(path.join(FAKE_WORKSPACE, TOOLS));
    });
  });

  describe('test metadataFolder', () => {
    let stateFolderStub: jest.SpyInstance;
    let usernameStub: jest.SpyInstance;
    beforeEach(() => {
      FAKE_WORKSPACE_INSTANCE.username = 'fakeUsername';
      stateFolderStub = jest.spyOn(projectPaths, 'stateFolder').mockReturnValue(FAKE_WORKSPACE);

      usernameStub = jest.spyOn(WorkspaceContextUtil, 'getInstance').mockReturnValue(FAKE_WORKSPACE_INSTANCE);
    });
    it('should be defined', () => {
      expect(projectPaths.metadataFolder).toBeDefined();
    });

    it('should return a path to the metadata folder based on root workspace', () => {
      const metadataFolder = projectPaths.metadataFolder();
      const username = FAKE_WORKSPACE_INSTANCE.username;
      expect(metadataFolder).toEqual(path.join(FAKE_WORKSPACE, ORGS, username, METADATA));
    });
  });

  describe('test apexTestResultsFolder', () => {
    let stateFolderStub: jest.SpyInstance;

    beforeEach(() => {
      stateFolderStub = jest.spyOn(projectPaths, 'stateFolder').mockReturnValue(FAKE_WORKSPACE);
    });
    it('should be defined', () => {
      expect(projectPaths.apexTestResultsFolder).toBeDefined();
    });

    it('should return a path to the apex test results folder based on root workspace', () => {
      const apexTestResultsFolder = projectPaths.apexTestResultsFolder();
      expect(apexTestResultsFolder).toEqual(path.join(FAKE_WORKSPACE, TOOLS, TEST_RESULTS, APEX));
    });
  });

  describe('test apexLanguageServerDatabase', () => {
    let stateFolderStub: jest.SpyInstance;

    beforeEach(() => {
      stateFolderStub = jest.spyOn(projectPaths, 'stateFolder').mockReturnValue(FAKE_WORKSPACE);
    });
    it('should be defined', () => {
      expect(projectPaths.apexLanguageServerDatabase).toBeDefined();
    });

    it('should return a path to the apex Language Server Database folder based on root workspace', () => {
      const apexLanguageServerDatabase = projectPaths.apexLanguageServerDatabase();
      expect(apexLanguageServerDatabase).toEqual(path.join(FAKE_WORKSPACE, TOOLS, APEX_DB));
    });
  });

  describe('test lwcTestResultsFolder', () => {
    let stateFolderStub: jest.SpyInstance;

    beforeEach(() => {
      stateFolderStub = jest.spyOn(projectPaths, 'stateFolder').mockReturnValue(FAKE_WORKSPACE);
    });
    it('should be defined', () => {
      expect(projectPaths.lwcTestResultsFolder).toBeDefined();
    });

    it('should return a path to the lwc Test Results Folder based on root workspace', () => {
      const lwcTestResultsFolder = projectPaths.lwcTestResultsFolder();
      expect(lwcTestResultsFolder).toEqual(path.join(FAKE_WORKSPACE, TOOLS, TEST_RESULTS, LWC));
    });
  });

  describe('test testResultsFolder', () => {
    let stateFolderStub: jest.SpyInstance;

    beforeEach(() => {
      stateFolderStub = jest.spyOn(projectPaths, 'stateFolder').mockReturnValue(FAKE_WORKSPACE);
    });
    it('should be defined', () => {
      expect(projectPaths.testResultsFolder).toBeDefined();
    });

    it('should return a path to the  Test Results Folder based on root workspace', () => {
      const testResultsFolder = projectPaths.testResultsFolder();
      expect(testResultsFolder).toEqual(path.join(FAKE_WORKSPACE, TOOLS, TEST_RESULTS));
    });
  });

  describe('test debugLogsFolder', () => {
    let stateFolderStub: jest.SpyInstance;

    beforeEach(() => {
      stateFolderStub = jest.spyOn(projectPaths, 'stateFolder').mockReturnValue(FAKE_WORKSPACE);
    });
    it('should be defined', () => {
      expect(projectPaths.debugLogsFolder).toBeDefined();
    });

    it('should return a path to the debug Logs folder based on root workspace', () => {
      const debugLogsFolder = projectPaths.debugLogsFolder();
      expect(debugLogsFolder).toEqual(path.join(FAKE_WORKSPACE, TOOLS, DEBUG, LOGS));
    });
  });

  describe('test fileExtensionsMatch', () => {
    const mockEditor = {
      document: {
        uri: { path: 'foo.log' } as vscode.Uri
      }
    };

    beforeEach(() => {
      (vscode.window.activeTextEditor as any).mockReturnValue(mockEditor);
    });

    it('should return true if the extension of the uri given is the same as the target extension', () => {
      const extensionsMatching = fileExtensionsMatch(mockEditor.document.uri, 'log');
      expect(extensionsMatching).toBeTruthy();
    });

    it('should return false if the extension of the uri given is not the same as the target extension', () => {
      const extensionsMatching = fileExtensionsMatch(mockEditor.document.uri, 'txt');
      expect(extensionsMatching).toBeFalsy();
    });
  });
});
