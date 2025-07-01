/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { filesDiffer } from '../../../src/conflict/conflictUtils';

describe('conflictUtils', () => {
  let workspaceFsReadFileMock: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    workspaceFsReadFileMock = jest.spyOn(vscode.workspace.fs, 'readFile');
  });

  afterEach(() => {
    workspaceFsReadFileMock.mockRestore();
  });

  describe('filesDiffer', () => {
    it('should return true when files have different content', async () => {
      const file1 = '/path/to/file1.txt';
      const file2 = '/path/to/file2.txt';

      workspaceFsReadFileMock
        .mockResolvedValueOnce(Buffer.from('content1'))
        .mockResolvedValueOnce(Buffer.from('content2'));

      const result = await filesDiffer(file1, file2);

      expect(result).toBe(true);
      expect(workspaceFsReadFileMock).toHaveBeenCalledTimes(2);
      expect(workspaceFsReadFileMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          path: file1,
          scheme: 'file'
        })
      );
      expect(workspaceFsReadFileMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          path: file2,
          scheme: 'file'
        })
      );
    });

    it('should return false when files have identical content', async () => {
      const file1 = '/path/to/file1.txt';
      const file2 = '/path/to/file2.txt';
      const content = 'identical content';

      workspaceFsReadFileMock.mockResolvedValueOnce(Buffer.from(content)).mockResolvedValueOnce(Buffer.from(content));

      const result = await filesDiffer(file1, file2);

      expect(result).toBe(false);
      expect(workspaceFsReadFileMock).toHaveBeenCalledTimes(2);
      expect(workspaceFsReadFileMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          path: file1,
          scheme: 'file'
        })
      );
      expect(workspaceFsReadFileMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          path: file2,
          scheme: 'file'
        })
      );
    });

    it('should handle empty files correctly', async () => {
      const file1 = '/path/to/empty1.txt';
      const file2 = '/path/to/empty2.txt';

      workspaceFsReadFileMock.mockResolvedValueOnce(Buffer.from('')).mockResolvedValueOnce(Buffer.from(''));

      const result = await filesDiffer(file1, file2);

      expect(result).toBe(false);
      expect(workspaceFsReadFileMock).toHaveBeenCalledTimes(2);
    });

    it('should detect differences when one file is empty and the other is not', async () => {
      const file1 = '/path/to/empty.txt';
      const file2 = '/path/to/nonempty.txt';

      workspaceFsReadFileMock.mockResolvedValueOnce(Buffer.from('')).mockResolvedValueOnce(Buffer.from('some content'));

      const result = await filesDiffer(file1, file2);

      expect(result).toBe(true);
      expect(workspaceFsReadFileMock).toHaveBeenCalledTimes(2);
    });

    it('should handle binary content correctly', async () => {
      const file1 = '/path/to/binary1.bin';
      const file2 = '/path/to/binary2.bin';
      const binary1 = Buffer.from([0x01, 0x02, 0x03]);
      const binary2 = Buffer.from([0x01, 0x02, 0x04]);

      workspaceFsReadFileMock.mockResolvedValueOnce(binary1).mockResolvedValueOnce(binary2);

      const result = await filesDiffer(file1, file2);

      expect(result).toBe(true);
      expect(workspaceFsReadFileMock).toHaveBeenCalledTimes(2);
    });

    it('should handle large content efficiently with Promise.all', async () => {
      const file1 = '/path/to/large1.txt';
      const file2 = '/path/to/large2.txt';
      const largeContent1 = 'a'.repeat(10000);
      const largeContent2 = 'b'.repeat(10000);

      workspaceFsReadFileMock
        .mockResolvedValueOnce(Buffer.from(largeContent1))
        .mockResolvedValueOnce(Buffer.from(largeContent2));

      const startTime = Date.now();
      const result = await filesDiffer(file1, file2);
      const endTime = Date.now();

      expect(result).toBe(true);
      expect(workspaceFsReadFileMock).toHaveBeenCalledTimes(2);
      // Both files should be read in parallel, so the total time should be roughly
      // the time of one read operation, not two sequential reads
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });

    it('should propagate readFile errors', async () => {
      const file1 = '/path/to/file1.txt';
      const file2 = '/path/to/file2.txt';
      const error = new Error('File not found');

      workspaceFsReadFileMock.mockRejectedValueOnce(error);

      await expect(filesDiffer(file1, file2)).rejects.toThrow('File not found');
      expect(workspaceFsReadFileMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          path: file1,
          scheme: 'file'
        })
      );
      expect(workspaceFsReadFileMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          path: file2,
          scheme: 'file'
        })
      );
    });

    it('should handle case-sensitive string comparisons', async () => {
      const file1 = '/path/to/file1.txt';
      const file2 = '/path/to/file2.txt';

      workspaceFsReadFileMock
        .mockResolvedValueOnce(Buffer.from('Hello World'))
        .mockResolvedValueOnce(Buffer.from('hello world'));

      const result = await filesDiffer(file1, file2);

      expect(result).toBe(true);
      expect(workspaceFsReadFileMock).toHaveBeenCalledTimes(2);
    });
  });
});
