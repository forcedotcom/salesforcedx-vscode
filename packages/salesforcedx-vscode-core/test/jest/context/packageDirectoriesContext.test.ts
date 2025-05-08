/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfProject } from '@salesforce/core-bundle';
import { workspaceUtils, TelemetryService } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import {
  checkPackageDirectoriesEditorView,
  checkPackageDirectoriesExplorerView
} from '../../../src/context/packageDirectoriesContext';

// Mock all external dependencies
jest.mock('@salesforce/salesforcedx-utils-vscode', () => {
  const mockTelemetryService = {
    hrTimeToMilliseconds: jest.fn().mockReturnValue(100)
  };

  return {
    workspaceUtils: {
      getRootWorkspacePath: jest.fn()
    },
    TelemetryService: {
      getInstance: jest.fn().mockReturnValue(mockTelemetryService)
    }
  };
});

jest.mock('vscode', () => ({
  window: {
    activeTextEditor: undefined
  },
  workspace: {
    fs: {
      readDirectory: jest.fn()
    }
  },
  commands: {
    executeCommand: jest.fn()
  },
  FileType: {
    File: 1,
    Directory: 2
  },
  Uri: {
    file: (filepath: string) => ({ fsPath: filepath })
  },
  Disposable: class {
    dispose() {}
  }
}));

jest.mock('@salesforce/source-tracking-bundle', () => ({}));
jest.mock('@salesforce/source-deploy-retrieve-bundle', () => ({}));
jest.mock('@salesforce/core-bundle', () => ({
  SfProject: {
    resolve: jest.fn()
  }
}));

// Mock console.debug to prevent errors
console.debug = jest.fn();

describe('packageDirectoriesContext', () => {
  const mockProjectPath = '/mock/project/path';
  const mockPackageDirectories = [{ path: 'force-app' }, { path: 'path2' }];

  // Define the specific paths we want to verify
  const packageRoot = path.join(mockProjectPath, 'force-app');
  const packageMain = path.join(mockProjectPath, 'force-app', 'main');
  const packageDefault = path.join(mockProjectPath, 'force-app', 'main', 'default');
  const packageClasses = path.join(mockProjectPath, 'force-app', 'main', 'default', 'classes');
  const packageClass1 = path.join(mockProjectPath, 'force-app', 'main', 'default', 'classes', 'Class1.cls');
  const packageClass1Metadata = path.join(
    mockProjectPath,
    'force-app',
    'main',
    'default',
    'classes',
    'Class1.cls-meta.xml'
  );
  const packageClass2 = path.join(mockProjectPath, 'force-app', 'main', 'default', 'classes', 'Class2.cls');
  const packageClass2Metadata = path.join(
    mockProjectPath,
    'force-app',
    'main',
    'default',
    'classes',
    'Class2.cls-meta.xml'
  );
  const packageLwc = path.join(mockProjectPath, 'force-app', 'main', 'default', 'lwc');
  const packageLwc1 = path.join(mockProjectPath, 'force-app', 'main', 'default', 'lwc', 'lwc1');
  const packageLwc1TestsFolder = path.join(mockProjectPath, 'force-app', 'main', 'default', 'lwc', 'lwc1', '__tests__');
  const packageLwc1Test = path.join(
    mockProjectPath,
    'force-app',
    'main',
    'default',
    'lwc',
    'lwc1',
    '__tests__',
    'lwc1.test.js'
  );
  const packageLwc1Html = path.join(mockProjectPath, 'force-app', 'main', 'default', 'lwc', 'lwc1', 'lwc1.html');
  const packageLwc1Js = path.join(mockProjectPath, 'force-app', 'main', 'default', 'lwc', 'lwc1', 'lwc1.js');
  const packageLwc1Metadata = path.join(
    mockProjectPath,
    'force-app',
    'main',
    'default',
    'lwc',
    'lwc1',
    'lwc1.js-meta.xml'
  );
  const packageRoot2 = path.join(mockProjectPath, 'path2');
  const packageRoot2File = path.join(mockProjectPath, 'path2', 'file.txt');

  beforeEach(() => {
    jest.clearAllMocks();
    (workspaceUtils.getRootWorkspacePath as jest.Mock).mockReturnValue(mockProjectPath);
    (SfProject.resolve as jest.Mock).mockResolvedValue({
      getSfProjectJson: () => ({
        getPackageDirectories: jest.fn().mockResolvedValue(mockPackageDirectories)
      })
    });

    // Ensure TelemetryService mock is properly set up
    (TelemetryService.getInstance as jest.Mock).mockReturnValue({
      hrTimeToMilliseconds: jest.fn().mockReturnValue(100)
    });

    // Mock the directory reading for each level
    (vscode.workspace.fs.readDirectory as jest.Mock).mockImplementation((uri: URI) => {
      const currentPath = uri.fsPath;
      if (currentPath === packageRoot) {
        return Promise.resolve([['main', vscode.FileType.Directory]]);
      } else if (currentPath === path.join(mockProjectPath, 'force-app', 'main')) {
        return Promise.resolve([['default', vscode.FileType.Directory]]);
      } else if (currentPath === packageDefault) {
        return Promise.resolve([
          ['classes', vscode.FileType.Directory],
          ['lwc', vscode.FileType.Directory]
        ]);
      } else if (currentPath === packageClasses) {
        return Promise.resolve([
          ['Class1.cls', vscode.FileType.File],
          ['Class1.cls-meta.xml', vscode.FileType.File],
          ['Class2.cls', vscode.FileType.File],
          ['Class2.cls-meta.xml', vscode.FileType.File]
        ]);
      } else if (currentPath === packageLwc) {
        return Promise.resolve([['lwc1', vscode.FileType.Directory]]);
      } else if (currentPath === packageLwc1) {
        return Promise.resolve([
          ['__tests__', vscode.FileType.Directory],
          ['lwc1.html', vscode.FileType.File],
          ['lwc1.js', vscode.FileType.File],
          ['lwc1.js-meta.xml', vscode.FileType.File]
        ]);
      } else if (currentPath === packageLwc1TestsFolder) {
        return Promise.resolve([['lwc1.test.js', vscode.FileType.File]]);
      } else if (currentPath === packageRoot2) {
        return Promise.resolve([['file.txt', vscode.FileType.File]]);
      }
      return Promise.resolve([]);
    });
  });

  describe('checkPackageDirectoriesEditorView', () => {
    it('should return true when file is in package directories', async () => {
      const mockUri = {
        fsPath: path.join(mockProjectPath, 'force-app', 'main', 'default', 'classes', 'Class1.cls')
      };
      (vscode.window.activeTextEditor as any) = {
        document: { uri: mockUri }
      };

      const result = await checkPackageDirectoriesEditorView();
      expect(result).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:in_package_directories', true);
    });

    it('should return false when file is not in package directories', async () => {
      const mockUri = {
        fsPath: path.join(mockProjectPath, 'this', 'is', 'an', 'invalid', 'path', 'helloworld.txt')
      };
      (vscode.window.activeTextEditor as any) = {
        document: { uri: mockUri }
      };

      const result = await checkPackageDirectoriesEditorView();
      expect(result).toBe(false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:in_package_directories', false);
    });

    it('should return false when there is no active editor', async () => {
      (vscode.window.activeTextEditor as any) = undefined;

      const result = await checkPackageDirectoriesEditorView();
      expect(result).toBe(false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:in_package_directories', false);
    });

    it('should handle errors gracefully', async () => {
      (SfProject.resolve as jest.Mock).mockRejectedValue(new Error('Test error'));
      const mockUri = {
        fsPath: path.join(mockProjectPath, 'force-app', 'test.cls')
      };
      (vscode.window.activeTextEditor as any) = {
        document: { uri: mockUri }
      };

      const result = await checkPackageDirectoriesEditorView();
      expect(result).toBe(false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:in_package_directories', false);
    });
  });

  describe('checkPackageDirectoriesExplorerView', () => {
    it('should set packageDirectoriesFolders context with all directories', async () => {
      await checkPackageDirectoriesExplorerView();

      // Check if the setContext command was called
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'packageDirectoriesFolders',
        expect.any(Array)
      );

      // Get the actual paths that were set in the context
      const setContextCalls = (vscode.commands.executeCommand as jest.Mock).mock.calls.filter(
        call => call[0] === 'setContext' && call[1] === 'packageDirectoriesFolders'
      );

      // Check if we found any matching calls
      expect(setContextCalls.length).toBeGreaterThan(0);

      const actualPaths = setContextCalls[0][2];

      // Verify that the package directory path is included
      expect(actualPaths).toContain(packageRoot);

      // Verify that the array contains all the expected paths
      expect(actualPaths).toEqual([
        packageRoot,
        packageMain,
        packageDefault,
        packageClasses,
        packageClass1,
        packageClass1Metadata,
        packageClass2,
        packageClass2Metadata,
        packageLwc,
        packageLwc1,
        packageLwc1TestsFolder,
        packageLwc1Test,
        packageLwc1Html,
        packageLwc1Js,
        packageLwc1Metadata,
        packageRoot2,
        packageRoot2File
      ]);
    });

    it('should handle errors gracefully', async () => {
      (SfProject.resolve as jest.Mock).mockRejectedValue(new Error('Test error'));

      await checkPackageDirectoriesExplorerView();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'packageDirectoriesFolders', []);
    });
  });
});
