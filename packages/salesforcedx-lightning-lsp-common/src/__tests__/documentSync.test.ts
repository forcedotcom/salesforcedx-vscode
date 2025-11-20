/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { syncDocumentToTextDocumentsProvider } from '../documentSync';
import { FileSystemDataProvider } from '../providers/fileSystemDataProvider';

describe('syncDocumentToTextDocumentsProvider', () => {
  let provider: FileSystemDataProvider;
  const workspaceRoots = ['/workspace'];

  beforeEach(() => {
    provider = new FileSystemDataProvider();
  });

  afterEach(() => {
    provider.clear();
  });

  it('should normalize file:// URI to fsPath and sync document', async () => {
    const uri = 'file:///workspace/src/file.js';
    const content = 'console.log("test");';

    await syncDocumentToTextDocumentsProvider(uri, content, provider, workspaceRoots);

    const fsPath = '/workspace/src/file.js';
    expect(provider.getFileContent(fsPath)).toBe(content);
    const stat = provider.getFileStat(fsPath);
    expect(stat?.type).toBe('file');
    expect(stat?.exists).toBe(true);
    expect(stat?.size).toBe(content.length);
  });

  it('should handle fsPath format URI', async () => {
    const uri = '/workspace/src/file.js';
    const content = 'const x = 1;';

    await syncDocumentToTextDocumentsProvider(uri, content, provider, workspaceRoots);

    expect(provider.getFileContent(uri)).toBe(content);
    const stat = provider.getFileStat(uri);
    expect(stat?.type).toBe('file');
    expect(stat?.exists).toBe(true);
  });

  it('should create parent directories when syncing nested file', async () => {
    const uri = 'file:///workspace/src/components/button.js';
    const content = 'export default class Button {}';

    await syncDocumentToTextDocumentsProvider(uri, content, provider, workspaceRoots);

    const fsPath = '/workspace/src/components/button.js';
    expect(provider.getFileContent(fsPath)).toBe(content);

    // Check that parent directories are created
    expect(provider.directoryExists('/workspace')).toBe(true);
    expect(provider.directoryExists('/workspace/src')).toBe(true);
    expect(provider.directoryExists('/workspace/src/components')).toBe(true);
  });

  it('should add file to parent directory listing', async () => {
    const uri = 'file:///workspace/src/file.js';
    const content = 'test content';

    await syncDocumentToTextDocumentsProvider(uri, content, provider, workspaceRoots);

    const fsPath = '/workspace/src/file.js';
    const parentDir = '/workspace/src';
    const entries = provider.getDirectoryListing(parentDir);

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('file.js');
    expect(entries[0].type).toBe('file');
    expect(entries[0].uri).toBe(fsPath);
  });

  it('should handle multiple files in same directory', async () => {
    const uri1 = 'file:///workspace/src/file1.js';
    const uri2 = 'file:///workspace/src/file2.js';
    const content1 = 'content1';
    const content2 = 'content2';

    await syncDocumentToTextDocumentsProvider(uri1, content1, provider, workspaceRoots);
    await syncDocumentToTextDocumentsProvider(uri2, content2, provider, workspaceRoots);

    expect(provider.getFileContent('/workspace/src/file1.js')).toBe(content1);
    expect(provider.getFileContent('/workspace/src/file2.js')).toBe(content2);

    const entries = provider.getDirectoryListing('/workspace/src');
    expect(entries).toHaveLength(2);
    expect(entries.map(e => e.name)).toContain('file1.js');
    expect(entries.map(e => e.name)).toContain('file2.js');
  });

  it('should not duplicate file in directory listing when syncing same file twice', async () => {
    const uri = 'file:///workspace/src/file.js';
    const content1 = 'content1';
    const content2 = 'content2';

    await syncDocumentToTextDocumentsProvider(uri, content1, provider, workspaceRoots);
    await syncDocumentToTextDocumentsProvider(uri, content2, provider, workspaceRoots);

    // Content should be updated
    expect(provider.getFileContent('/workspace/src/file.js')).toBe(content2);

    // Directory listing should only have one entry
    const entries = provider.getDirectoryListing('/workspace/src');
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('file.js');
  });

  it('should set correct file stat metadata', async () => {
    const uri = 'file:///workspace/src/file.js';
    const content = 'test content with some length';

    const beforeTime = Date.now();
    await syncDocumentToTextDocumentsProvider(uri, content, provider, workspaceRoots);
    const afterTime = Date.now();

    const stat = provider.getFileStat('/workspace/src/file.js');
    expect(stat).toBeDefined();
    expect(stat?.type).toBe('file');
    expect(stat?.exists).toBe(true);
    expect(stat?.size).toBe(content.length);
    expect(stat?.ctime).toBeGreaterThanOrEqual(beforeTime);
    expect(stat?.ctime).toBeLessThanOrEqual(afterTime);
    expect(stat?.mtime).toBeGreaterThanOrEqual(beforeTime);
    expect(stat?.mtime).toBeLessThanOrEqual(afterTime);
  });

  it('should handle file in root workspace directory', async () => {
    const uri = 'file:///workspace/root.js';
    const content = 'root file';

    await syncDocumentToTextDocumentsProvider(uri, content, provider, workspaceRoots);

    expect(provider.getFileContent('/workspace/root.js')).toBe(content);
    expect(provider.directoryExists('/workspace')).toBe(true);
  });

  it('should handle empty content', async () => {
    const uri = 'file:///workspace/src/empty.js';
    const content = '';

    await syncDocumentToTextDocumentsProvider(uri, content, provider, workspaceRoots);

    expect(provider.getFileContent('/workspace/src/empty.js')).toBe('');
    const stat = provider.getFileStat('/workspace/src/empty.js');
    expect(stat?.size).toBe(0);
  });

  it('should handle deeply nested file paths', async () => {
    const uri = 'file:///workspace/src/components/ui/buttons/primary.js';
    const content = 'deeply nested';

    await syncDocumentToTextDocumentsProvider(uri, content, provider, workspaceRoots);

    const fsPath = '/workspace/src/components/ui/buttons/primary.js';
    expect(provider.getFileContent(fsPath)).toBe(content);

    // All parent directories should exist
    expect(provider.directoryExists('/workspace')).toBe(true);
    expect(provider.directoryExists('/workspace/src')).toBe(true);
    expect(provider.directoryExists('/workspace/src/components')).toBe(true);
    expect(provider.directoryExists('/workspace/src/components/ui')).toBe(true);
    expect(provider.directoryExists('/workspace/src/components/ui/buttons')).toBe(true);
  });

  it('should handle Windows-style paths in URI', async () => {
    const uri = 'file:///C:/workspace/src/file.js';
    const content = 'windows path';

    await syncDocumentToTextDocumentsProvider(uri, content, provider, ['C:/workspace']);

    // URI.parse converts Windows paths - check that content was stored
    // The exact path format depends on the platform, but content should be accessible
    const allFiles = provider.getAllFileUris();
    const fileWithContent = allFiles.find(file => provider.getFileContent(file) === content);
    expect(fileWithContent).toBeDefined();
    expect(provider.getFileContent(fileWithContent!)).toBe(content);
  });

  it('should update file stat when syncing same file with different content', async () => {
    const uri = 'file:///workspace/src/file.js';
    const content1 = 'short';
    const content2 = 'much longer content';

    await syncDocumentToTextDocumentsProvider(uri, content1, provider, workspaceRoots);
    const stat1 = provider.getFileStat('/workspace/src/file.js');

    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await syncDocumentToTextDocumentsProvider(uri, content2, provider, workspaceRoots);
    const stat2 = provider.getFileStat('/workspace/src/file.js');

    expect(stat2?.size).toBe(content2.length);
    expect(stat2?.size).not.toBe(stat1?.size);
    expect(stat2?.mtime).toBeGreaterThanOrEqual(stat1?.mtime ?? 0);
  });

  it('should handle files with special characters in name', async () => {
    const uri = 'file:///workspace/src/file-name_123.js';
    const content = 'special chars';

    await syncDocumentToTextDocumentsProvider(uri, content, provider, workspaceRoots);

    expect(provider.getFileContent('/workspace/src/file-name_123.js')).toBe(content);
    const entries = provider.getDirectoryListing('/workspace/src');
    expect(entries[0].name).toBe('file-name_123.js');
  });
});
