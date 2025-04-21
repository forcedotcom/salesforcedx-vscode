import * as vscode from 'vscode';
import * as path from 'path';
import { SfProject } from '@salesforce/core-bundle';
import { workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
// import { checkPackageDirectoriesEditorView, checkPackageDirectoriesExplorerView } from '../../../src/context/packageDirectoriesContext';
import { checkPackageDirectoriesExplorerView } from '../../../src/context/packageDirectoriesContext';

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
    file: (path: string) => ({ fsPath: path })
  },
  Disposable: class {
    dispose() { }
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
  const mockPackageDirectories = [
    { path: 'force-app' }
  ];

  // Define the specific paths we want to verify
  const packageRoot = path.join(mockProjectPath, 'force-app');
  const packageMain = path.join(mockProjectPath, 'force-app', 'main');
  const packageDefault = path.join(mockProjectPath, 'force-app', 'main', 'default');
  const packageClasses = path.join(mockProjectPath, 'force-app', 'main', 'default', 'classes');
  const packageFile = path.join(mockProjectPath, 'force-app', 'main', 'default', 'classes', 'elephant.apex');

  beforeEach(() => {
    jest.clearAllMocks();
    (workspaceUtils.getRootWorkspacePath as jest.Mock).mockReturnValue(mockProjectPath);
    (SfProject.resolve as jest.Mock).mockResolvedValue({
      getSfProjectJson: () => ({
        getPackageDirectories: jest.fn().mockResolvedValue(mockPackageDirectories)
      })
    });

    // Ensure TelemetryService mock is properly set up
    const { TelemetryService } = require('@salesforce/salesforcedx-utils-vscode');
    (TelemetryService.getInstance as jest.Mock).mockReturnValue({
      hrTimeToMilliseconds: jest.fn().mockReturnValue(100)
    });

    // Mock the directory reading for each level
    (vscode.workspace.fs.readDirectory as jest.Mock)
      .mockImplementation((uri: vscode.Uri) => {
        const currentPath = uri.fsPath;
        if (currentPath === packageRoot) {
          return Promise.resolve([['main', vscode.FileType.Directory]]);
        } else if (currentPath === path.join(mockProjectPath, 'force-app', 'main')) {
          return Promise.resolve([['default', vscode.FileType.Directory]]);
        } else if (currentPath === packageDefault) {
          return Promise.resolve([['classes', vscode.FileType.Directory]]);
        } else if (currentPath === packageClasses) {
          return Promise.resolve([['elephant.apex', vscode.FileType.File]]);
        }
        return Promise.resolve([]);
      });
  });

  // describe('checkPackageDirectoriesEditorView', () => {
  //   it('should return true when file is in package directories', async () => {
  //     const mockUri = {
  //       fsPath: path.join(mockProjectPath, 'force-app', 'test.cls')
  //     };
  //     (vscode.window.activeTextEditor as any) = {
  //       document: { uri: mockUri }
  //     };

  //     const result = await checkPackageDirectoriesEditorView();
  //     expect(result).toBe(true);
  //     expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
  //       'setContext',
  //       'sf:in_package_directories',
  //       true
  //     );
  //   });

  //   it('should return false when file is not in package directories', async () => {
  //     const mockUri = {
  //       fsPath: path.join(mockProjectPath, 'other', 'test.cls')
  //     };
  //     (vscode.window.activeTextEditor as any) = {
  //       document: { uri: mockUri }
  //     };

  //     const result = await checkPackageDirectoriesEditorView();
  //     expect(result).toBe(false);
  //     expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
  //       'setContext',
  //       'sf:in_package_directories',
  //       false
  //     );
  //   });

  //   it('should return false when there is no active editor', async () => {
  //     (vscode.window.activeTextEditor as any) = undefined;

  //     const result = await checkPackageDirectoriesEditorView();
  //     expect(result).toBe(false);
  //     expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
  //       'setContext',
  //       'sf:in_package_directories',
  //       false
  //     );
  //   });

  //   it('should handle errors gracefully', async () => {
  //     (SfProject.resolve as jest.Mock).mockRejectedValue(new Error('Test error'));
  //     const mockUri = {
  //       fsPath: path.join(mockProjectPath, 'force-app', 'test.cls')
  //     };
  //     (vscode.window.activeTextEditor as any) = {
  //       document: { uri: mockUri }
  //     };

  //     const result = await checkPackageDirectoriesEditorView();
  //     expect(result).toBe(false);
  //     expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
  //       'setContext',
  //       'sf:in_package_directories',
  //       false
  //     );
  //   });
  // });

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

      // Debug information
      console.log('All mock calls:', (vscode.commands.executeCommand as jest.Mock).mock.calls);
      console.log('Filtered setContext calls:', setContextCalls);

      // Check if we found any matching calls
      expect(setContextCalls.length).toBeGreaterThan(0);

      const actualPaths = setContextCalls[0][2];
      console.log('Actual paths:', actualPaths);

      // Verify that the package directory path is included
      expect(actualPaths).toContain(packageRoot);

      // Verify that the array contains all the expected paths
      expect(actualPaths).toEqual(
        [
          packageRoot,
          packageMain,
          packageDefault,
          packageClasses,
          packageFile
        ]
      );
    });

    it('should handle errors gracefully', async () => {
      (SfProject.resolve as jest.Mock).mockRejectedValue(new Error('Test error'));

      await checkPackageDirectoriesExplorerView();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'packageDirectoriesFolders',
        []
      );
    });
  });
});
