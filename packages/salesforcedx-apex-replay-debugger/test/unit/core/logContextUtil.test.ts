/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { LogContextUtil } from '../../../src/core/logContextUtil';

jest.mock('vscode');

describe('Log context utilities', () => {
  describe('Read log file', () => {
    let util: LogContextUtil;

    beforeEach(() => {
      util = new LogContextUtil();
      jest.clearAllMocks();
    });

    it('Should return empty array with bad log file', async () => {
      (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      const result = await util.readLogFile('foo.log');
      expect(result).toHaveLength(0);
    });

    it('Should return array of log lines', async () => {
      const mockContent = Buffer.from('line1\nline2\nline3', 'utf8');
      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(mockContent);
      const result = await util.readLogFile('test.log');
      expect(result).not.toHaveLength(0);
      expect(result).toEqual(['line1', 'line2', 'line3']);
    });

    it('Should get file size', async () => {
      const mockFileStat = { size: 123 };
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue(mockFileStat as vscode.FileStat);
      const result = await util.getFileSize('test.log');
      expect(result).toBeGreaterThan(0);
      expect(result).toBe(123);
    });

    it('Should strip brackets', () => {
      expect(util.stripBrackets('[20]')).toBe('20');
    });
  });
});
