/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SourceComponent } from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { sourceDiff, sourceFolderDiff } from '../../../src/commands/sourceDiff';
import { SfCommandlet } from '../../../src/commands/util';
import * as differ from '../../../src/conflict/directoryDiffer';
import { MetadataCacheExecutor, MetadataCacheResult, PathType } from '../../../src/conflict/metadataCacheService';
import { WorkspaceContext } from '../../../src/context';
import { nls } from '../../../src/messages';
import { notificationService } from '../../../src/notifications';

// Mock modules whose real implementation we want to avoid
jest.mock('../../../src/conflict/directoryDiffer');
jest.mock('../../../src/commands/util/sfCommandlet');
jest.mock('../../../src/conflict/metadataCacheService');
jest.mock('../../../src/commands/util/parameterGatherers');

describe('sourceDiff', () => {
  let diffFolderSpy: jest.SpyInstance;
  let diffMultipleFilesSpy: jest.SpyInstance;
  let diffOneFileSpy: jest.SpyInstance;
  let showErrorMessageSpy: jest.SpyInstance;
  let getInstanceSpy: jest.SpyInstance;

  const mockVscode = vscode as jest.Mocked<typeof vscode>;
  const mockSfCommandlet = SfCommandlet as jest.Mock;
  const mockMetadataCacheExecutor = MetadataCacheExecutor as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockVscode.window.activeTextEditor as any) = undefined;

    diffFolderSpy = jest.spyOn(differ, 'diffFolder');
    diffMultipleFilesSpy = jest.spyOn(differ, 'diffMultipleFiles');
    diffOneFileSpy = jest.spyOn(differ, 'diffOneFile');
    showErrorMessageSpy = jest.spyOn(notificationService, 'showErrorMessage');
    getInstanceSpy = jest.spyOn(WorkspaceContext, 'getInstance');

    mockSfCommandlet.mockImplementation(() => ({
      run: jest.fn()
    }));
  });

  describe('sourceDiff', () => {
    it('should execute source diff with provided URI', async () => {
      const sourceUri = URI.file('/test/path/file.cls');
      const username = 'test@example.com';
      getInstanceSpy.mockReturnValue({ username });

      await sourceDiff(sourceUri);

      expect(getInstanceSpy).toHaveBeenCalled();
      expect(mockMetadataCacheExecutor).toHaveBeenCalled();
      expect(mockSfCommandlet).toHaveBeenCalled();
    });

    it('should execute source diff with URI from active editor when no URI provided', async () => {
      const resolvedUri = URI.file('/test/path/file.cls');
      const username = 'test@example.com';
      (mockVscode.window.activeTextEditor as any) = {
        document: { uri: resolvedUri }
      };
      getInstanceSpy.mockReturnValue({ username });

      await sourceDiff();

      expect(getInstanceSpy).toHaveBeenCalled();
      expect(mockMetadataCacheExecutor).toHaveBeenCalled();
      expect(mockSfCommandlet).toHaveBeenCalled();
    });

    it('should return early when no URI is resolved', async () => {
      await sourceDiff();
      expect(getInstanceSpy).not.toHaveBeenCalled();
    });

    it('should show error when no default org is set', async () => {
      const sourceUri = URI.file('/test/path/file.cls');
      getInstanceSpy.mockReturnValue({ username: undefined });
      await sourceDiff(sourceUri);
      expect(showErrorMessageSpy).toHaveBeenCalledWith(nls.localize('missing_default_org'));
    });
  });

  describe('sourceFolderDiff', () => {
    it('should execute folder diff with provided URI', async () => {
      const explorerPath = URI.file('/test/folder');
      const username = 'test@example.com';
      getInstanceSpy.mockReturnValue({ username });

      await sourceFolderDiff(explorerPath);

      expect(getInstanceSpy).toHaveBeenCalled();
      expect(mockMetadataCacheExecutor).toHaveBeenCalled();
      expect(mockSfCommandlet).toHaveBeenCalled();
    });

    it('should execute folder diff with URI from active editor when no URI provided', async () => {
      const resolvedUri = URI.file('/test/folder');
      const username = 'test@example.com';
      (mockVscode.window.activeTextEditor as any) = {
        document: { uri: resolvedUri }
      };
      getInstanceSpy.mockReturnValue({ username });

      await sourceFolderDiff();

      expect(getInstanceSpy).toHaveBeenCalled();
    });

    it('should return early when no URI is resolved', async () => {
      await sourceFolderDiff();
      expect(getInstanceSpy).not.toHaveBeenCalled();
    });

    it('should show error when no default org is set', async () => {
      const explorerPath = URI.file('/test/folder');
      getInstanceSpy.mockReturnValue({ username: undefined });
      await sourceFolderDiff(explorerPath);
      expect(showErrorMessageSpy).toHaveBeenCalledWith(nls.localize('missing_default_org'));
    });
  });

  describe('handleCacheResults (via executor callback)', () => {
    it('should call diffOneFile for individual path type', async () => {
      const username = 'test@example.com';
      const mockCache: MetadataCacheResult = {
        selectedPath: '/test/path/file.cls',
        selectedType: PathType.Individual,
        cache: {
          baseDirectory: '/cache/dir',
          commonRoot: 'classes',
          components: [
            {
              content: '/cache/dir/classes/file.cls',
              xml: '/cache/dir/classes/file.cls-meta.xml',
              type: { name: 'ApexClass' },
              fullName: 'file'
            } as SourceComponent
          ]
        },
        project: { baseDirectory: '/project/dir', commonRoot: 'classes', components: [] },
        properties: []
      };
      getInstanceSpy.mockReturnValue({ username });

      await sourceDiff(URI.file('/test/path/file.cls'));
      const handleCacheResultsCallback = mockMetadataCacheExecutor.mock.calls[0][3];
      await handleCacheResultsCallback(username, mockCache);

      expect(diffOneFileSpy).toHaveBeenCalledWith('/test/path/file.cls', mockCache.cache.components[0], username);
    });

    it('should call diffMultipleFiles for multiple path type', async () => {
      const username = 'test@example.com';
      const selectedPaths = ['/test/path1.cls', '/test/path2.cls'];
      const mockCache: MetadataCacheResult = {
        selectedPath: selectedPaths,
        selectedType: PathType.Multiple,
        cache: {
          baseDirectory: '/cache/dir',
          commonRoot: 'classes',
          components: [
            {
              content: '/cache/dir/classes/file1.cls',
              xml: '/cache/dir/classes/file1.cls-meta.xml',
              type: { name: 'ApexClass' },
              fullName: 'file1'
            } as SourceComponent,
            {
              content: '/cache/dir/classes/file2.cls',
              xml: '/cache/dir/classes/file2.cls-meta.xml',
              type: { name: 'ApexClass' },
              fullName: 'file2'
            } as SourceComponent
          ]
        },
        project: { baseDirectory: '/project/dir', commonRoot: 'classes', components: [] },
        properties: []
      };
      getInstanceSpy.mockReturnValue({ username });

      await sourceDiff(URI.file('/test/path/file.cls'));
      const handleCacheResultsCallback = mockMetadataCacheExecutor.mock.calls[0][3];
      await handleCacheResultsCallback(username, mockCache);

      expect(diffMultipleFilesSpy).toHaveBeenCalledWith(username, selectedPaths, mockCache);
    });

    it('should call diffFolder for folder path type', async () => {
      const username = 'test@example.com';
      const mockCache: MetadataCacheResult = {
        selectedPath: '/test/folder',
        selectedType: PathType.Folder,
        cache: { baseDirectory: '/cache/dir', commonRoot: 'classes', components: [] },
        project: { baseDirectory: '/project/dir', commonRoot: 'classes', components: [] },
        properties: []
      };
      getInstanceSpy.mockReturnValue({ username });

      await sourceDiff(URI.file('/test/path/file.cls'));
      const handleCacheResultsCallback = mockMetadataCacheExecutor.mock.calls[0][3];
      await handleCacheResultsCallback(username, mockCache);

      expect(diffFolderSpy).toHaveBeenCalledWith(mockCache, username);
    });

    it('should show error message when cache is undefined', async () => {
      const username = 'test@example.com';
      const mockCache = undefined;
      getInstanceSpy.mockReturnValue({ username });

      await sourceDiff(URI.file('/test/path/file.cls'));
      const handleCacheResultsCallback = mockMetadataCacheExecutor.mock.calls[0][3];

      await expect(handleCacheResultsCallback(username, mockCache)).rejects.toThrow(
        nls.localize('source_diff_components_not_in_org')
      );
      expect(showErrorMessageSpy).toHaveBeenCalledWith(nls.localize('source_diff_components_not_in_org'));
    });
  });
});
