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
import { checkPackageDirectoriesEditorView } from '../../../src/context/packageDirectoriesContext';

// Mock all external dependencies
jest.mock('@salesforce/salesforcedx-utils-vscode', () => {
  const mockTelemetryService = {
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
    public dispose() {}
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
  const packageDefault = path.join(mockProjectPath, 'force-app', 'main', 'default');
  const packageClasses = path.join(mockProjectPath, 'force-app', 'main', 'default', 'classes');
  const packageLwc = path.join(mockProjectPath, 'force-app', 'main', 'default', 'lwc');
  const packageLwc1 = path.join(mockProjectPath, 'force-app', 'main', 'default', 'lwc', 'lwc1');
  const packageLwc1TestsFolder = path.join(mockProjectPath, 'force-app', 'main', 'default', 'lwc', 'lwc1', '__tests__');
  const packageRoot2 = path.join(mockProjectPath, 'path2');

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
});
