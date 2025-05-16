/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import {
  readFile,
  writeFile,
  fileOrFolderExists,
  createDirectory,
  deleteFile,
  readDirectory,
  stat,
  safeDelete
} from '../../../src/helpers/fs';

describe('file system utilities', () => {
  const mockUri = { fsPath: '/test/path' };
  const mockError = new Error('Test error');

  beforeEach(() => {
    jest.clearAllMocks();
    (vscode.Uri.file as jest.Mock).mockReturnValue(mockUri);
  });

  describe('readFile', () => {
    it('should read file content successfully', async () => {
      const mockContent = new Uint8Array([1, 2, 3]);
      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(mockContent);

      const result = await readFile('/test/path');
      expect(vscode.workspace.fs.readFile).toHaveBeenCalledWith(mockUri);
      expect(result).toBe(Buffer.from(mockContent).toString('utf8'));
    });

    it('should throw error when read fails', async () => {
      (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(mockError);

      await expect(readFile('/test/path')).rejects.toThrow('Failed to read file /test/path: Test error');
    });
  });

  describe('writeFile', () => {
    it('should write file content successfully', async () => {
      const content = 'test content';
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.Directory });
      (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await writeFile('/test/path', content);
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(mockUri, new TextEncoder().encode(content));
    });

    it('should create directory if it does not exist', async () => {
      const content = 'test content';
      (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(mockError);
      (vscode.workspace.fs.createDirectory as jest.Mock).mockResolvedValue(undefined);
      (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await writeFile('/test/path', content);
      expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
    });

    it('should throw error when write fails', async () => {
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.Directory });
      (vscode.workspace.fs.writeFile as jest.Mock).mockRejectedValue(mockError);

      await expect(writeFile('/test/path', 'content')).rejects.toThrow('Failed to write file /test/path: Test error');
    });
  });

  describe('fileOrFolderExists', () => {
    it('should return true when file exists', async () => {
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.File });

      const result = await fileOrFolderExists('/test/path');
      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(mockError);

      const result = await fileOrFolderExists('/test/path');
      expect(result).toBe(false);
    });
  });

  describe('createDirectory', () => {
    it('should create directory if it does not exist', async () => {
      (vscode.workspace.fs.createDirectory as jest.Mock).mockResolvedValue(undefined);

      await createDirectory('/test/path');
      expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledWith(mockUri);
    });

    it('should do nothing if directory already exists', async () => {
      (vscode.workspace.fs.createDirectory as jest.Mock).mockResolvedValue(undefined);

      // First call creates the directory
      await createDirectory('/test/path');
      // Second call should not fail
      await createDirectory('/test/path');

      expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledTimes(2);
      expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledWith(mockUri);
    });

    it('should create parent directories as needed', async () => {
      const deepPath = '/test/path/to/deep/directory';
      const deepUri = { fsPath: deepPath };
      (vscode.Uri.file as jest.Mock).mockReturnValue(deepUri);
      (vscode.workspace.fs.createDirectory as jest.Mock).mockResolvedValue(undefined);

      await createDirectory(deepPath);
      expect(vscode.workspace.fs.createDirectory).toHaveBeenCalledWith(deepUri);
    });

    it('should throw error when creation fails', async () => {
      (vscode.workspace.fs.createDirectory as jest.Mock).mockRejectedValue(mockError);

      await expect(createDirectory('/test/path')).rejects.toThrow('Failed to create directory /test/path: Test error');
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      (vscode.workspace.fs.delete as jest.Mock).mockResolvedValue(undefined);

      await deleteFile('/test/path');
      expect(vscode.workspace.fs.delete).toHaveBeenCalledWith(mockUri, {});
    });

    it('should throw error when deletion fails', async () => {
      (vscode.workspace.fs.delete as jest.Mock).mockRejectedValue(mockError);

      await expect(deleteFile('/test/path')).rejects.toThrow('Failed to delete file /test/path: Test error');
    });
  });

  describe('safeDelete', () => {
    it('should delete file if it exists', async () => {
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.File });
      (vscode.workspace.fs.delete as jest.Mock).mockResolvedValue(undefined);

      await safeDelete('/test/path');
      expect(vscode.workspace.fs.delete).toHaveBeenCalledWith(mockUri, undefined);
    });

    it('should do nothing if file does not exist', async () => {
      (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(mockError);

      await safeDelete('/test/path');
      expect(vscode.workspace.fs.delete).not.toHaveBeenCalled();
    });
  });

  describe('readDirectory', () => {
    it('should read directory contents successfully', async () => {
      const mockEntries: [string, vscode.FileType][] = [
        ['file1.txt', vscode.FileType.File],
        ['dir1', vscode.FileType.Directory]
      ];
      (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockEntries);

      const result = await readDirectory('/test/path');
      expect(result).toEqual(['file1.txt', 'dir1']);
    });

    it('should throw error when read fails', async () => {
      (vscode.workspace.fs.readDirectory as jest.Mock).mockRejectedValue(mockError);

      await expect(readDirectory('/test/path')).rejects.toThrow('Failed to read directory /test/path: Test error');
    });
  });

  describe('stat', () => {
    it('should get file stats successfully', async () => {
      const mockStats = { type: vscode.FileType.File, size: 100, ctime: 123, mtime: 456 };
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue(mockStats);

      const result = await stat('/test/path');
      expect(result).toEqual(mockStats);
    });

    it('should throw error when stat fails', async () => {
      (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(mockError);

      await expect(stat('/test/path')).rejects.toThrow('Failed to get file stats for /test/path: Test error');
    });
  });
});
