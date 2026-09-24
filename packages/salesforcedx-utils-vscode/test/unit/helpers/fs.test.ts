/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Mock as VitestMock } from 'vitest';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { readFile, fileOrFolderExists } from '../../../src/helpers/fs';

vi.mock('vscode');
describe('file system utilities', () => {
  const mockUri = { fsPath: '/test/path' };
  const mockError = new Error('Test error');

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - partial mock
    vi.spyOn(URI, 'file').mockImplementation((fsPath: string) => ({ fsPath }));
  });

  describe('readFile', () => {
    it('should read file content successfully', async () => {
      const mockContent = new Uint8Array([1, 2, 3]);
      (vscode.workspace.fs.readFile as VitestMock).mockResolvedValue(mockContent);

      const result = await readFile('/test/path');
      expect(vscode.workspace.fs.readFile).toHaveBeenCalledWith(mockUri);
      expect(result).toBe(Buffer.from(mockContent).toString('utf8'));
    });

    it('should throw error when read fails', async () => {
      (vscode.workspace.fs.readFile as VitestMock).mockRejectedValue(mockError);

      await expect(readFile('/test/path')).rejects.toThrow('Failed to read file /test/path: Test error');
    });
  });

  describe('fileOrFolderExists', () => {
    it('should return true when file exists', async () => {
      (vscode.workspace.fs.stat as VitestMock).mockResolvedValue({ type: vscode.FileType.File });

      const result = await fileOrFolderExists('/test/path');
      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      (vscode.workspace.fs.stat as VitestMock).mockRejectedValue(mockError);

      const result = await fileOrFolderExists('/test/path');
      expect(result).toBe(false);
    });
  });
});
