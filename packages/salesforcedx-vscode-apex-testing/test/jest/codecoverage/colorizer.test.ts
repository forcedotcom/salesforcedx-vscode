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

import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { CodeCoverageHandler } from '../../../src/codecoverage/colorizer';
import { StatusBarToggle } from '../../../src/codecoverage/statusBarToggle';
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
    // activeTextEditor is not spied (mock may not support getter); constructor calls onDidChangeActiveTextEditor(undefined) when undefined
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
      jest.spyOn(vscode.workspace.fs, 'stat').mockRejectedValue(new Error('no file'));
      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
        get: jest.fn().mockReturnValue(false)
      } as unknown as vscode.WorkspaceConfiguration);
      jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined as unknown as vscode.MessageItem);

      await handler.toggleCoverage();

      expect(mockStatusBar.toggle).toHaveBeenCalledWith(true);
    });

    it('reads test-run-id.txt from the org-scoped folder returned by getTestResultsFolder', async () => {
      (mockStatusBar as { isHighlightingEnabled: boolean }).isHighlightingEnabled = false;
      const orgScopedFolder = URI.file('/workspace/project/.sfdx/tools/testresults/apex/00DQI00000NGcnN2AT');
      const workspaceFolders = [
        { uri: URI.file('/workspace/project'), name: 'project', index: 0 }
      ] as vscode.WorkspaceFolder[];
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: workspaceFolders,
        configurable: true,
        writable: true
      });
      (getTestResultsFolder as jest.Mock).mockResolvedValue(orgScopedFolder);

      const testRunId = '707QI00001AMz3r';
      const expectedTestRunIdUri = Utils.joinPath(orgScopedFolder, 'test-run-id.txt');
      const expectedResultUri = Utils.joinPath(orgScopedFolder, `test-result-${testRunId}.json`);
      const statSpy = jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({} as vscode.FileStat);
      jest.spyOn(vscode.workspace.fs, 'readFile').mockImplementation((uri: URI) => {
        if (uri.path === expectedTestRunIdUri.path) {
          return Promise.resolve(new TextEncoder().encode(testRunId));
        }
        if (uri.path === expectedResultUri.path) {
          return Promise.resolve(new TextEncoder().encode(JSON.stringify({ codecoverage: [] })));
        }
        return Promise.reject(new Error(`unexpected read: ${uri.path}`));
      });

      Object.defineProperty(mockEditor.document, 'uri', {
        value: URI.file('/workspace/project/force-app/main/default/classes/MyClass.cls'),
        configurable: true,
        writable: true
      });
      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
        get: jest.fn().mockReturnValue(false)
      } as unknown as vscode.WorkspaceConfiguration);
      jest.spyOn(vscode.window, 'showWarningMessage').mockResolvedValue(undefined as unknown as vscode.MessageItem);

      await handler.toggleCoverage();

      expect(getTestResultsFolder).toHaveBeenCalled();
      const statPaths = statSpy.mock.calls.map(([uri]) => (uri as URI).path);
      expect(statPaths).toContain(expectedTestRunIdUri.path);
      expect(statPaths).not.toContain('/workspace/project/.sfdx/tools/testresults/apex/test-run-id.txt');
    });
  });
});
