/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

jest.mock('../../../src/services/extensionProvider', () => ({
  getApexTestingRuntime: () => ({
    runPromise: jest.fn().mockResolvedValue(undefined)
  })
}));

jest.mock('../../../src/utils/pathHelpers', () => ({
  getTestResultsFolder: jest.fn()
}));

jest.mock('../../../src/settings', () => ({
  retrieveRestorePreviousResults: jest.fn().mockReturnValue(true)
}));

import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { CodeCoverageHandler } from '../../../src/codecoverage/colorizer';
import { StatusBarToggle } from '../../../src/codecoverage/statusBarToggle';
import * as settings from '../../../src/settings';
import { getTestResultsFolder } from '../../../src/utils/pathHelpers';

describe('CodeCoverageHandler', () => {
  let mockStatusBar: StatusBarToggle;
  let mockEditor: vscode.TextEditor;
  let handler: CodeCoverageHandler;
  let onDidChangeActiveTextEditorDisposable: { dispose: jest.Mock };

  beforeEach(() => {
    mockStatusBar = {
      isHighlightingEnabled: false,
      toggle: jest.fn(),
      dispose: jest.fn()
    } as unknown as StatusBarToggle;

    mockEditor = {
      document: {
        uri: URI.file('/workspace/project/MyClass.cls'),
        getText: jest.fn().mockReturnValue('public class MyClass { }'),
        lineAt: jest.fn().mockReturnValue({
          range: {
            start: { character: 0, line: 0 },
            end: { character: 20, line: 0 }
          }
        }),
        lineCount: 1
      },
      setDecorations: jest.fn()
    } as unknown as vscode.TextEditor;

    onDidChangeActiveTextEditorDisposable = { dispose: jest.fn() };
    jest.spyOn(vscode.window, 'onDidChangeActiveTextEditor').mockReturnValue(onDidChangeActiveTextEditorDisposable);
    Object.defineProperty(vscode.window, 'activeTextEditor', {
      value: mockEditor,
      configurable: true,
      writable: true
    });

    handler = new CodeCoverageHandler(mockStatusBar);
  });

  it('should subscribe to onDidChangeActiveTextEditor on construction', () => {
    expect(vscode.window.onDidChangeActiveTextEditor).toHaveBeenCalled();
  });

  describe('toggleCoverage', () => {
    it('when highlighting is enabled should turn off and clear decorations', async () => {
      (mockStatusBar as { isHighlightingEnabled: boolean }).isHighlightingEnabled = true;
      handler.coveredLines = [new vscode.Range(0, 0, 0, 10)];
      handler.uncoveredLines = [new vscode.Range(1, 0, 1, 10)];

      await handler.toggleCoverage();

      expect(mockStatusBar.toggle).toHaveBeenCalledWith(false);
      expect(handler.coveredLines).toEqual([]);
      expect(handler.uncoveredLines).toEqual([]);
      expect(mockEditor.setDecorations).toHaveBeenCalled();
    });

    it('when highlighting is disabled should turn on (and attempt to apply coverage)', async () => {
      (mockStatusBar as { isHighlightingEnabled: boolean }).isHighlightingEnabled = false;
      const workspaceFolders = [
        { uri: URI.file('/workspace/project'), name: 'project', index: 0 }
      ] as vscode.WorkspaceFolder[];
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: workspaceFolders,
        configurable: true,
        writable: true
      });
      (getTestResultsFolder as jest.Mock).mockResolvedValue(
        URI.file('/workspace/project/.sfdx/tools/testresults/apex/00DQI00000NGcnN2AT')
      );
      jest.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([]);
      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
        get: jest.fn().mockReturnValue(false)
      } as unknown as vscode.WorkspaceConfiguration);
      jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined as unknown as vscode.MessageItem);

      await handler.toggleCoverage();

      expect(mockStatusBar.toggle).toHaveBeenCalledWith(true);
    });

    describe('coverage aggregation', () => {
      const orgScopedFolder = URI.file('/workspace/project/.sfdx/tools/testresults/apex/00DQI00000NGcnN2AT');
      const now = Date.now();
      const recentMtime = now - 1000 * 60 * 60; // 1 hour ago

      afterEach(() => {
        jest.restoreAllMocks();
      });

      beforeEach(() => {
        (mockStatusBar as { isHighlightingEnabled: boolean }).isHighlightingEnabled = false;
        const workspaceFolders = [
          { uri: URI.file('/workspace/project'), name: 'project', index: 0 }
        ] as vscode.WorkspaceFolder[];
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
          value: workspaceFolders,
          configurable: true,
          writable: true
        });
        (getTestResultsFolder as jest.Mock).mockResolvedValue(orgScopedFolder);
        Object.defineProperty(mockEditor.document, 'uri', {
          value: URI.file('/workspace/project/force-app/main/default/classes/ClassA.cls'),
          configurable: true,
          writable: true
        });
        jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
          get: jest.fn().mockReturnValue(false)
        } as unknown as vscode.WorkspaceConfiguration);
        jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined as unknown as vscode.MessageItem);
      });

      it('aggregates coverage from multiple recent files (most recent wins per class)', async () => {
        jest.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
          ['test-result-001.json', vscode.FileType.File],
          ['test-result-002.json', vscode.FileType.File]
        ]);
        jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ mtime: recentMtime } as vscode.FileStat);
        jest.spyOn(vscode.workspace.fs, 'readFile').mockImplementation((uri: URI) => {
          if (uri.path.endsWith('test-result-001.json')) {
            return Promise.resolve(
              new TextEncoder().encode(
                JSON.stringify({ codecoverage: [{ name: 'ClassA', coveredLines: [1], uncoveredLines: [2, 3] }] })
              )
            );
          }
          if (uri.path.endsWith('test-result-002.json')) {
            return Promise.resolve(
              new TextEncoder().encode(
                JSON.stringify({ codecoverage: [{ name: 'ClassA', coveredLines: [1, 2, 3], uncoveredLines: [] }] })
              )
            );
          }
          return Promise.reject(new Error(`unexpected read: ${uri.path}`));
        });

        await handler.toggleCoverage();

        // setDecorations called twice: covered lines, then uncovered lines
        expect(mockEditor.setDecorations).toHaveBeenCalledTimes(2);
        const calls = (mockEditor.setDecorations as jest.Mock).mock.calls;
        const coveredRanges = calls[0][1] as unknown[];
        const uncoveredRanges = calls[1][1] as unknown[];
        // File 002 wins: 3 covered lines, 0 uncovered
        expect(coveredRanges).toHaveLength(3);
        expect(uncoveredRanges).toHaveLength(0);
      });

      it('merges coverage from different classes across runs', async () => {
        Object.defineProperty(mockEditor.document, 'uri', {
          value: URI.file('/workspace/project/force-app/main/default/classes/ClassB.cls'),
          configurable: true,
          writable: true
        });
        jest.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
          ['test-result-001.json', vscode.FileType.File],
          ['test-result-002.json', vscode.FileType.File]
        ]);
        jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ mtime: recentMtime } as vscode.FileStat);
        jest.spyOn(vscode.workspace.fs, 'readFile').mockImplementation((uri: URI) => {
          if (uri.path.endsWith('test-result-001.json')) {
            return Promise.resolve(
              new TextEncoder().encode(
                JSON.stringify({ codecoverage: [{ name: 'ClassA', coveredLines: [1], uncoveredLines: [] }] })
              )
            );
          }
          if (uri.path.endsWith('test-result-002.json')) {
            return Promise.resolve(
              new TextEncoder().encode(
                JSON.stringify({ codecoverage: [{ name: 'ClassB', coveredLines: [5, 6], uncoveredLines: [7] }] })
              )
            );
          }
          return Promise.reject(new Error(`unexpected read: ${uri.path}`));
        });

        await handler.toggleCoverage();

        // ClassB found in merged results — decorations applied (2 sets: covered + uncovered)
        expect(mockEditor.setDecorations).toHaveBeenCalledTimes(2);
        const calls = (mockEditor.setDecorations as jest.Mock).mock.calls;
        const coveredRanges = calls[0][1] as vscode.Range[];
        const uncoveredRanges = calls[1][1] as vscode.Range[];
        expect(coveredRanges).toHaveLength(2); // lines 5, 6
        expect(uncoveredRanges).toHaveLength(1); // line 7
      });

      it('excludes files older than 24 hours', async () => {
        const oldMtime = now - 25 * 60 * 60 * 1000; // 25 hours ago
        jest.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
          ['test-result-001.json', vscode.FileType.File],
          ['test-result-002.json', vscode.FileType.File]
        ]);
        jest.spyOn(vscode.workspace.fs, 'stat').mockImplementation((uri: URI) => {
          if (uri.path.endsWith('test-result-001.json')) {
            return Promise.resolve({ mtime: oldMtime } as vscode.FileStat);
          }
          return Promise.resolve({ mtime: recentMtime } as vscode.FileStat);
        });
        jest.spyOn(vscode.workspace.fs, 'readFile').mockImplementation((uri: URI) => {
          if (uri.path.endsWith('test-result-001.json')) {
            return Promise.resolve(
              new TextEncoder().encode(
                JSON.stringify({ codecoverage: [{ name: 'ClassA', coveredLines: [1], uncoveredLines: [2, 3, 4, 5] }] })
              )
            );
          }
          if (uri.path.endsWith('test-result-002.json')) {
            return Promise.resolve(
              new TextEncoder().encode(
                JSON.stringify({
                  codecoverage: [{ name: 'ClassA', coveredLines: [1, 2, 3, 4, 5], uncoveredLines: [] }]
                })
              )
            );
          }
          return Promise.reject(new Error(`unexpected read: ${uri.path}`));
        });

        await handler.toggleCoverage();

        // Only file 002 (recent) should be used — 5 covered lines, 0 uncovered
        const calls = (mockEditor.setDecorations as jest.Mock).mock.calls;
        const coveredRanges = calls[0][1] as vscode.Range[];
        const uncoveredRanges = calls[1][1] as vscode.Range[];
        expect(coveredRanges).toHaveLength(5);
        expect(uncoveredRanges).toHaveLength(0);
      });

      it('excludes -codecoverage.json files from aggregation', async () => {
        jest.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
          ['test-result-001.json', vscode.FileType.File],
          ['test-result-001-codecoverage.json', vscode.FileType.File]
        ]);
        jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ mtime: recentMtime } as vscode.FileStat);
        const readFileSpy = jest.spyOn(vscode.workspace.fs, 'readFile').mockImplementation((uri: URI) => {
          if (uri.path.endsWith('test-result-001.json')) {
            return Promise.resolve(
              new TextEncoder().encode(
                JSON.stringify({ codecoverage: [{ name: 'ClassA', coveredLines: [1], uncoveredLines: [] }] })
              )
            );
          }
          return Promise.reject(new Error(`unexpected read: ${uri.path}`));
        });

        await handler.toggleCoverage();

        const readPaths = readFileSpy.mock.calls.map(([uri]) => (uri as URI).path);
        expect(readPaths).not.toContain(expect.stringContaining('-codecoverage.json'));
      });

      it('throws when directory is empty', async () => {
        jest.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([]);
        jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined as unknown as vscode.MessageItem);

        await handler.toggleCoverage();

        expect(mockStatusBar.toggle).toHaveBeenCalledWith(true);
      });

      it('only reads the most recent file when restore-previous-results is disabled', async () => {
        (settings.retrieveRestorePreviousResults as jest.Mock).mockReturnValue(false);
        jest.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
          ['test-result-001.json', vscode.FileType.File],
          ['test-result-002.json', vscode.FileType.File]
        ]);
        jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ mtime: recentMtime } as vscode.FileStat);
        const readCalls: string[] = [];
        jest.spyOn(vscode.workspace.fs, 'readFile').mockImplementation((uri: URI) => {
          readCalls.push(uri.path);
          if (uri.path.endsWith('test-result-002.json')) {
            return Promise.resolve(
              new TextEncoder().encode(
                JSON.stringify({ codecoverage: [{ name: 'ClassA', coveredLines: [1, 2], uncoveredLines: [3] }] })
              )
            );
          }
          return Promise.reject(new Error(`unexpected read: ${uri.path}`));
        });

        await handler.toggleCoverage();

        // Only the most recent file (002) should be read
        expect(readCalls.some(p => p.endsWith('test-result-001.json'))).toBe(false);
        expect(readCalls.some(p => p.endsWith('test-result-002.json'))).toBe(true);
        (settings.retrieveRestorePreviousResults as jest.Mock).mockReturnValue(true);
      });

      it('picks newest file by mtime when filenames are not chronologically sortable', async () => {
        // Apex test-result filenames embed Salesforce 18-char run IDs that are not
        // chronologically sortable, so alphabetical order can disagree with mtime.
        (settings.retrieveRestorePreviousResults as jest.Mock).mockReturnValue(false);
        const olderMtime = now - 1000 * 60 * 60 * 2; // 2 hours ago
        const newerMtime = now - 1000 * 60; // 1 minute ago
        jest.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
          ['test-result-707xx0000099999.json', vscode.FileType.File], // alphabetically last, but older
          ['test-result-707xx0000011111.json', vscode.FileType.File] // alphabetically first, but newer
        ]);
        jest.spyOn(vscode.workspace.fs, 'stat').mockImplementation((uri: URI) => {
          if (uri.path.endsWith('test-result-707xx0000099999.json')) {
            return Promise.resolve({ mtime: olderMtime } as vscode.FileStat);
          }
          return Promise.resolve({ mtime: newerMtime } as vscode.FileStat);
        });
        const readCalls: string[] = [];
        jest.spyOn(vscode.workspace.fs, 'readFile').mockImplementation((uri: URI) => {
          readCalls.push(uri.path);
          if (uri.path.endsWith('test-result-707xx0000011111.json')) {
            return Promise.resolve(
              new TextEncoder().encode(
                JSON.stringify({ codecoverage: [{ name: 'ClassA', coveredLines: [1, 2, 3], uncoveredLines: [] }] })
              )
            );
          }
          if (uri.path.endsWith('test-result-707xx0000099999.json')) {
            return Promise.resolve(
              new TextEncoder().encode(
                JSON.stringify({ codecoverage: [{ name: 'ClassA', coveredLines: [1], uncoveredLines: [2, 3] }] })
              )
            );
          }
          return Promise.reject(new Error(`unexpected read: ${uri.path}`));
        });

        await handler.toggleCoverage();

        // The alphabetically-last file (99999) is older — it must NOT be read.
        // The alphabetically-first file (11111) is newer — it must be the one used.
        expect(readCalls.some(p => p.endsWith('test-result-707xx0000099999.json'))).toBe(false);
        expect(readCalls.some(p => p.endsWith('test-result-707xx0000011111.json'))).toBe(true);
        const calls = (mockEditor.setDecorations as jest.Mock).mock.calls;
        const coveredRanges = calls[0][1] as vscode.Range[];
        const uncoveredRanges = calls[1][1] as vscode.Range[];
        expect(coveredRanges).toHaveLength(3);
        expect(uncoveredRanges).toHaveLength(0);
        (settings.retrieveRestorePreviousResults as jest.Mock).mockReturnValue(true);
      });

      it('throws when files exist but none contain coverage keys', async () => {
        jest
          .spyOn(vscode.workspace.fs, 'readDirectory')
          .mockResolvedValue([['test-result-001.json', vscode.FileType.File]]);
        jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ mtime: recentMtime } as vscode.FileStat);
        jest
          .spyOn(vscode.workspace.fs, 'readFile')
          .mockResolvedValue(new TextEncoder().encode(JSON.stringify({ tests: [{ outcome: 'Pass' }] })));

        await handler.toggleCoverage();

        // Should still toggle on (error is handled by the handler)
        expect(mockStatusBar.toggle).toHaveBeenCalledWith(true);
      });
    });
  });
});
