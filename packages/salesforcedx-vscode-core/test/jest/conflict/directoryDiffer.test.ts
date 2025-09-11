/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fsUtils from '@salesforce/salesforcedx-utils-vscode';
import type { SourceComponent } from '@salesforce/source-deploy-retrieve';
import * as path from 'node:path';
import * as vscode from 'vscode';
import * as conflictModule from '../../../src/conflict';
import { diffFolder, diffMultipleFiles, diffOneFile } from '../../../src/conflict/directoryDiffer';
import { MetadataCacheResult, PathType } from '../../../src/conflict/metadataCacheService';
import { notificationService } from '../../../src/notifications';

// Mock dependencies
jest.mock('../../../src/conflict', () => ({
  conflictView: {
    visualizeDifferences: jest.fn()
  }
}));

// Mock file system operations
jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  ...jest.requireActual('@salesforce/salesforcedx-utils-vscode'),
  readDirectory: jest.fn().mockResolvedValue(['TestClass1.cls', 'TestClass1.cls-meta.xml']),
  isDirectory: jest.fn().mockImplementation((filePath: string) =>
    // Return false for files, true for directories
    Promise.resolve(!filePath.includes('.cls') && !filePath.includes('.xml') && !filePath.includes('.txt'))
  )
}));

describe('directoryDiffer', () => {
  let mockNotificationService: any;
  let mockConflictView: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockNotificationService = jest.spyOn(notificationService, 'showErrorMessage');
    mockConflictView = (conflictModule as any).conflictView;

    // Mock vscode.commands.executeCommand
    jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

    // Mock file system operations with jest.spyOn
    jest.spyOn(fsUtils, 'readDirectory').mockResolvedValue(['TestClass1.cls', 'TestClass1.cls-meta.xml']);
    jest
      .spyOn(fsUtils, 'isDirectory')
      .mockImplementation((filePath: string) =>
        Promise.resolve(!filePath.includes('.cls') && !filePath.includes('.xml') && !filePath.includes('.txt'))
      );
    jest.spyOn(fsUtils, 'readFile').mockResolvedValue('test content');
  });

  describe('diffFolder', () => {
    it('should call visualizeDifferences with correct parameters', async () => {
      // Arrange
      const mockCache: MetadataCacheResult = {
        selectedPath: path.join('test', 'project'),
        selectedType: PathType.Folder,
        cache: {
          baseDirectory: path.join('cache', 'dir'),
          commonRoot: path.join('main', 'default'),
          components: []
        },
        project: {
          baseDirectory: path.join('project', 'dir'),
          commonRoot: path.join('main', 'default'),
          components: []
        },
        properties: []
      };
      const username = 'test@example.com';

      // Act
      await diffFolder(mockCache, username);

      // Assert
      expect(mockConflictView.visualizeDifferences).toHaveBeenCalledWith(
        'test@example.com - File Diffs',
        username,
        true,
        expect.any(Object),
        true
      );
    });

    it('should handle cache with different common roots', async () => {
      // Arrange
      const mockCache: MetadataCacheResult = {
        selectedPath: path.join('test', 'project'),
        selectedType: PathType.Folder,
        cache: {
          baseDirectory: path.join('cache', 'dir'),
          commonRoot: 'classes',
          components: []
        },
        project: {
          baseDirectory: path.join('project', 'dir'),
          commonRoot: 'classes',
          components: []
        },
        properties: []
      };
      const username = 'test@example.com';

      // Act
      await diffFolder(mockCache, username);

      // Assert
      expect(mockConflictView.visualizeDifferences).toHaveBeenCalled();
    });
  });

  describe('diffMultipleFiles', () => {
    it('should process multiple files and call visualizeDifferences', async () => {
      // Arrange
      const username = 'test@example.com';
      const selectedPaths = [
        path.join('project', 'dir', 'classes', 'TestClass1.cls'),
        path.join('project', 'dir', 'classes', 'TestClass2.cls')
      ];
      const mockCache: MetadataCacheResult = {
        selectedPath: selectedPaths,
        selectedType: PathType.Multiple,
        cache: {
          baseDirectory: path.join('cache', 'dir'),
          commonRoot: 'classes',
          components: [
            {
              content: path.join('cache', 'dir', 'classes', 'TestClass1.cls'),
              xml: path.join('cache', 'dir', 'classes', 'TestClass1.cls-meta.xml'),
              type: { name: 'ApexClass' },
              fullName: 'TestClass1'
            } as SourceComponent,
            {
              content: path.join('cache', 'dir', 'classes', 'TestClass2.cls'),
              xml: path.join('cache', 'dir', 'classes', 'TestClass2.cls-meta.xml'),
              type: { name: 'ApexClass' },
              fullName: 'TestClass2'
            } as SourceComponent
          ]
        },
        project: {
          baseDirectory: path.join('project', 'dir'),
          commonRoot: 'classes',
          components: []
        },
        properties: []
      };

      // Act
      await diffMultipleFiles(username, selectedPaths, mockCache);

      // Assert
      expect(mockConflictView.visualizeDifferences).toHaveBeenCalledWith(
        'test@example.com - File Diffs',
        username,
        true,
        expect.objectContaining({
          different: expect.any(Set),
          localRoot: path.join('project', 'dir'),
          remoteRoot: path.join('cache', 'dir'),
          scannedLocal: 2,
          scannedRemote: 2
        }),
        true
      );
    });

    it('should handle empty selectedPaths array', async () => {
      // Arrange
      const username = 'test@example.com';
      const selectedPaths: string[] = [];
      const mockCache: MetadataCacheResult = {
        selectedPath: selectedPaths,
        selectedType: PathType.Multiple,
        cache: {
          baseDirectory: path.join('cache', 'dir'),
          commonRoot: 'classes',
          components: []
        },
        project: {
          baseDirectory: path.join('project', 'dir'),
          commonRoot: 'classes',
          components: []
        },
        properties: []
      };

      // Act
      await diffMultipleFiles(username, selectedPaths, mockCache);

      // Assert
      expect(mockConflictView.visualizeDifferences).toHaveBeenCalledWith(
        'test@example.com - File Diffs',
        username,
        true,
        expect.objectContaining({
          different: expect.any(Set),
          localRoot: path.join('project', 'dir'),
          remoteRoot: path.join('cache', 'dir'),
          scannedLocal: 0,
          scannedRemote: 0
        }),
        true
      );
    });

    it('should handle more selectedPaths than cache components', async () => {
      // Arrange
      const username = 'test@example.com';
      const selectedPaths = [
        path.join('project', 'dir', 'classes', 'TestClass1.cls'),
        path.join('project', 'dir', 'classes', 'TestClass2.cls'),
        path.join('project', 'dir', 'classes', 'TestClass3.cls')
      ];
      const mockCache: MetadataCacheResult = {
        selectedPath: selectedPaths,
        selectedType: PathType.Multiple,
        cache: {
          baseDirectory: path.join('cache', 'dir'),
          commonRoot: 'classes',
          components: [
            {
              content: path.join('cache', 'dir', 'classes', 'TestClass1.cls'),
              xml: path.join('cache', 'dir', 'classes', 'TestClass1.cls-meta.xml'),
              type: { name: 'ApexClass' },
              fullName: 'TestClass1'
            } as SourceComponent
          ]
        },
        project: {
          baseDirectory: path.join('project', 'dir'),
          commonRoot: 'classes',
          components: []
        },
        properties: []
      };

      // Act
      await diffMultipleFiles(username, selectedPaths, mockCache);

      // Assert
      expect(mockConflictView.visualizeDifferences).toHaveBeenCalledWith(
        'test@example.com - File Diffs',
        username,
        true,
        expect.objectContaining({
          different: expect.any(Set),
          localRoot: path.join('project', 'dir'),
          remoteRoot: path.join('cache', 'dir'),
          scannedLocal: 3,
          scannedRemote: 1
        }),
        true
      );
    });
  });

  describe('diffOneFile', () => {
    it('should execute diff command for matching file', async () => {
      // Arrange
      const localFile = path.join('project', 'dir', 'classes', 'TestClass.cls');
      const targetOrgorAlias = 'test@example.com';
      const mockRemoteComponent: SourceComponent = {
        content: path.join('cache', 'dir', 'classes', 'TestClass.cls'),
        xml: path.join('cache', 'dir', 'classes', 'TestClass.cls-meta.xml'),
        type: { name: 'ApexClass' },
        fullName: 'TestClass',
        walkContent: jest.fn().mockReturnValue([path.join('cache', 'dir', 'classes', 'TestClass.cls')])
      } as any;

      // Act
      await diffOneFile(localFile, mockRemoteComponent, targetOrgorAlias);

      // Assert
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'vscode.diff',
        expect.objectContaining({ fsPath: path.join('/', 'cache', 'dir', 'classes', 'TestClass.cls') }),
        expect.objectContaining({ fsPath: path.join('/', 'project', 'dir', 'classes', 'TestClass.cls') }),
        'test@example.com//TestClass.cls ↔ local//TestClass.cls'
      );
    });

    it('should handle component with xml file', async () => {
      // Arrange
      const localFile = path.join('project', 'dir', 'classes', 'TestClass.cls-meta.xml');
      const targetOrgorAlias = 'test@example.com';
      const mockRemoteComponent: SourceComponent = {
        content: path.join('cache', 'dir', 'classes', 'TestClass.cls'),
        xml: path.join('cache', 'dir', 'classes', 'TestClass.cls-meta.xml'),
        type: { name: 'ApexClass' },
        fullName: 'TestClass',
        walkContent: jest.fn().mockReturnValue([path.join('cache', 'dir', 'classes', 'TestClass.cls-meta.xml')])
      } as any;

      // Act
      await diffOneFile(localFile, mockRemoteComponent, targetOrgorAlias);

      // Assert
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'vscode.diff',
        expect.objectContaining({ fsPath: path.join('/', 'cache', 'dir', 'classes', 'TestClass.cls-meta.xml') }),
        expect.objectContaining({ fsPath: path.join('/', 'project', 'dir', 'classes', 'TestClass.cls-meta.xml') }),
        'test@example.com//TestClass.cls-meta.xml ↔ local//TestClass.cls-meta.xml'
      );
    });

    it('should handle diff command error', async () => {
      // Arrange
      const localFile = path.join('project', 'dir', 'classes', 'TestClass.cls');
      const targetOrgorAlias = 'test@example.com';
      const mockError = new Error('Diff command failed');
      const mockRemoteComponent: SourceComponent = {
        content: path.join('cache', 'dir', 'classes', 'TestClass.cls'),
        xml: path.join('cache', 'dir', 'classes', 'TestClass.cls-meta.xml'),
        type: { name: 'ApexClass' },
        fullName: 'TestClass',
        walkContent: jest.fn().mockReturnValue([path.join('cache', 'dir', 'classes', 'TestClass.cls')])
      } as any;

      jest.spyOn(vscode.commands, 'executeCommand').mockRejectedValue(mockError);

      // Act
      await diffOneFile(localFile, mockRemoteComponent, targetOrgorAlias);

      // Assert
      expect(mockNotificationService).toHaveBeenCalledWith(mockError.message);
    });

    it('should handle component without matching file', async () => {
      // Arrange
      const localFile = path.join('project', 'dir', 'classes', 'TestClass.cls');
      const targetOrgorAlias = 'test@example.com';
      const mockRemoteComponent: SourceComponent = {
        content: null,
        xml: null,
        type: { name: 'ApexClass' },
        fullName: 'TestClass',
        walkContent: jest.fn().mockReturnValue([])
      } as any;

      // Act
      await diffOneFile(localFile, mockRemoteComponent, targetOrgorAlias);

      // Assert
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should handle component with null content and xml', async () => {
      // Arrange
      const localFile = path.join('project', 'dir', 'classes', 'TestClass.cls');
      const targetOrgorAlias = 'test@example.com';
      const mockRemoteComponent: SourceComponent = {
        content: null,
        xml: null,
        type: { name: 'ApexClass' },
        fullName: 'TestClass',
        walkContent: jest.fn().mockReturnValue([])
      } as any;

      // Act
      await diffOneFile(localFile, mockRemoteComponent, targetOrgorAlias);

      // Assert
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('path handling', () => {
    it('should handle Windows paths correctly', async () => {
      // Arrange
      const username = 'test@example.com';
      const selectedPaths = [
        path.join('C:', 'project', 'dir', 'classes', 'TestClass1.cls'),
        path.join('C:', 'project', 'dir', 'classes', 'TestClass2.cls')
      ];
      const mockCache: MetadataCacheResult = {
        selectedPath: selectedPaths,
        selectedType: PathType.Multiple,
        cache: {
          baseDirectory: path.join('C:', 'cache', 'dir'),
          commonRoot: 'classes',
          components: [
            {
              content: path.join('C:', 'cache', 'dir', 'classes', 'TestClass1.cls'),
              xml: path.join('C:', 'cache', 'dir', 'classes', 'TestClass1.cls-meta.xml'),
              type: { name: 'ApexClass' },
              fullName: 'TestClass1'
            } as SourceComponent
          ]
        },
        project: {
          baseDirectory: path.join('C:', 'project', 'dir'),
          commonRoot: 'classes',
          components: []
        },
        properties: []
      };

      // Act
      await diffMultipleFiles(username, selectedPaths, mockCache);

      // Assert
      expect(mockConflictView.visualizeDifferences).toHaveBeenCalledWith(
        'test@example.com - File Diffs',
        username,
        true,
        expect.objectContaining({
          localRoot: path.join('C:', 'project', 'dir'),
          remoteRoot: path.join('C:', 'cache', 'dir')
        }),
        true
      );
    });

    it('should handle Unix paths correctly', async () => {
      // Arrange
      const username = 'test@example.com';
      const selectedPaths = [
        path.join('project', 'dir', 'classes', 'TestClass1.cls'),
        path.join('project', 'dir', 'classes', 'TestClass2.cls')
      ];
      const mockCache: MetadataCacheResult = {
        selectedPath: selectedPaths,
        selectedType: PathType.Multiple,
        cache: {
          baseDirectory: path.join('cache', 'dir'),
          commonRoot: 'classes',
          components: [
            {
              content: path.join('cache', 'dir', 'classes', 'TestClass1.cls'),
              xml: path.join('cache', 'dir', 'classes', 'TestClass1.cls-meta.xml'),
              type: { name: 'ApexClass' },
              fullName: 'TestClass1'
            } as SourceComponent
          ]
        },
        project: {
          baseDirectory: path.join('project', 'dir'),
          commonRoot: 'classes',
          components: []
        },
        properties: []
      };

      // Act
      await diffMultipleFiles(username, selectedPaths, mockCache);

      // Assert
      expect(mockConflictView.visualizeDifferences).toHaveBeenCalledWith(
        'test@example.com - File Diffs',
        username,
        true,
        expect.objectContaining({
          localRoot: path.join('project', 'dir'),
          remoteRoot: path.join('cache', 'dir')
        }),
        true
      );
    });
  });
});
