/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Controllable settings values surfaced through the mock SettingsService (replaces the old
// jest.mock('../../../src/settings') target, which is no longer in the coverage call path).
const settingsValues: { restorePrevious: boolean; disableWarnings: boolean } = {
  restorePrevious: true,
  disableWarnings: false
};
const mockAppendToChannel = jest.fn();

// Build a real CodeCoverageService.Default over a mock ExtensionProviderService whose api.services
// exposes a controllable SettingsService + ChannelService. getApexTestingRuntime runs effects for real.
jest.mock('../../../src/services/extensionProvider', () => {
  const EffectActual = jest.requireActual('effect/Effect');
  const LayerActual = jest.requireActual('effect/Layer');
  const ManagedRuntimeActual = jest.requireActual('effect/ManagedRuntime');
  const { ExtensionProviderService } = jest.requireActual('@salesforce/effect-ext-utils');
  const { CodeCoverageService: CodeCoverageServiceActual } = jest.requireActual(
    '../../../src/codecoverage/codeCoverageService'
  );

  const mockSettingsService = {
    getValue: (_section: string, key: string, _default: unknown) =>
      EffectActual.succeed(
        key === 'restore-previous-results' ? settingsValues.restorePrevious : settingsValues.disableWarnings
      )
  };
  const mockChannelService = {
    appendToChannel: (message: string) => EffectActual.sync(() => mockAppendToChannel(message))
  };
  const mockServicesApi = {
    services: {
      SettingsService: EffectActual.succeed(mockSettingsService),
      ChannelService: EffectActual.succeed(mockChannelService)
    }
  };
  const ExtensionProviderLive = LayerActual.succeed(ExtensionProviderService, {
    getServicesApi: EffectActual.succeed(mockServicesApi)
  });
  // merge (not provide): ExtensionProviderService is yielded at call time, so it must remain in the
  // runtime context (mirrors production, where buildAllServicesLayer keeps it ambient).
  const TestLayer = LayerActual.merge(CodeCoverageServiceActual.Default, ExtensionProviderLive);

  return {
    ExtensionProviderService,
    AllServicesLayer: TestLayer,
    getApexTestingRuntime: () => ManagedRuntimeActual.make(TestLayer)
  };
});

jest.mock('../../../src/utils/pathHelpers', () => ({
  getTestResultsFolder: jest.fn()
}));

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import {
  CodeCoverageService,
  NoCoverageForFileError,
  NoCoverageOnProjectError,
  OutOfSyncCoverageError,
  StaleResultsError
} from '../../../src/codecoverage/codeCoverageService';
import { CodeCoverageHandler } from '../../../src/codecoverage/colorizer';
import { StatusBarToggle } from '../../../src/codecoverage/statusBarToggle';
import { getApexTestingRuntime } from '../../../src/services/extensionProvider';
import { getTestResultsFolder } from '../../../src/utils/pathHelpers';

const orgScopedFolder = URI.file('/workspace/project/.sfdx/tools/testresults/apex/00DQI00000NGcnN2AT');
const now = Date.now();
const recentMtime = now - 1000 * 60 * 60; // 1 hour ago

const makeDocument = (uriPath: string): vscode.TextDocument =>
  ({
    uri: URI.file(uriPath),
    getText: jest.fn().mockReturnValue('public class MyClass { }'),
    lineAt: jest.fn().mockReturnValue({
      range: { start: { character: 0, line: 0 }, end: { character: 20, line: 0 } }
    }),
    lineCount: 1
  }) as unknown as vscode.TextDocument;

const setWorkspaceFolders = () => {
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    value: [{ uri: URI.file('/workspace/project'), name: 'project', index: 0 }],
    configurable: true,
    writable: true
  });
};

const encode = (obj: unknown) => new TextEncoder().encode(JSON.stringify(obj));

describe('CodeCoverageHandler', () => {
  let mockStatusBar: StatusBarToggle;
  let mockEditor: vscode.TextEditor;
  let handler: CodeCoverageHandler;
  let onDidChangeActiveTextEditorDisposable: { dispose: jest.Mock };

  beforeEach(() => {
    settingsValues.restorePrevious = true;
    settingsValues.disableWarnings = false;
    mockAppendToChannel.mockClear();

    mockStatusBar = {
      isHighlightingEnabled: false,
      toggle: jest.fn(),
      dispose: jest.fn()
    } as unknown as StatusBarToggle;

    mockEditor = {
      document: makeDocument('/workspace/project/MyClass.cls'),
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

  it('dispose() disposes the editor-change subscription', () => {
    handler.dispose();
    expect(onDidChangeActiveTextEditorDisposable.dispose).toHaveBeenCalled();
  });

  describe('toggleCoverage', () => {
    it('when highlighting is enabled should turn off and clear decorations', async () => {
      (mockStatusBar as { isHighlightingEnabled: boolean }).isHighlightingEnabled = true;

      await handler.toggleCoverage();

      expect(mockStatusBar.toggle).toHaveBeenCalledWith(false);
      // clear() returns empty ranges → both decoration sets cleared
      const calls = (mockEditor.setDecorations as jest.Mock).mock.calls;
      expect(calls[0][1]).toEqual([]);
      expect(calls[1][1]).toEqual([]);
    });

    it('when highlighting is disabled should turn on and apply coverage decorations', async () => {
      (mockStatusBar as { isHighlightingEnabled: boolean }).isHighlightingEnabled = false;
      setWorkspaceFolders();
      (getTestResultsFolder as jest.Mock).mockResolvedValue(orgScopedFolder);
      jest
        .spyOn(vscode.workspace.fs, 'readDirectory')
        .mockResolvedValue([['test-result-001.json', vscode.FileType.File]]);
      jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ mtime: recentMtime } as vscode.FileStat);
      jest
        .spyOn(vscode.workspace.fs, 'readFile')
        .mockResolvedValue(encode({ codecoverage: [{ name: 'MyClass', coveredLines: [1], uncoveredLines: [2] }] }));

      await handler.toggleCoverage();

      expect(mockStatusBar.toggle).toHaveBeenCalledWith(true);
      // both decoration sets applied with the computed ranges (covered + uncovered)
      const calls = (mockEditor.setDecorations as jest.Mock).mock.calls;
      expect(calls[0][1]).toHaveLength(1);
      expect(calls[1][1]).toHaveLength(1);
    });
  });
});

describe('CodeCoverageService', () => {
  // One disposable runtime per test: fresh Refs for isolation, disposed in afterEach so no scopes leak.
  let runtime: ReturnType<typeof getApexTestingRuntime>;
  const run = <A, E>(effect: Effect.Effect<A, E, CodeCoverageService>) => runtime.runPromise(effect);

  beforeEach(() => {
    jest.restoreAllMocks();
    mockAppendToChannel.mockClear();
    settingsValues.restorePrevious = true;
    settingsValues.disableWarnings = false;
    setWorkspaceFolders();
    (getTestResultsFolder as jest.Mock).mockResolvedValue(orgScopedFolder);
    runtime = getApexTestingRuntime();
  });

  afterEach(async () => {
    await runtime.dispose();
  });

  describe('Ref state', () => {
    it('getRanges starts empty, reflects applyForEditor, then clear resets it', async () => {
      const classADoc = () => makeDocument('/workspace/project/force-app/main/default/classes/ClassA.cls');
      expect(await run(CodeCoverageService.getRanges())).toEqual({ coveredLines: [], uncoveredLines: [] });

      jest
        .spyOn(vscode.workspace.fs, 'readDirectory')
        .mockResolvedValue([['test-result-001.json', vscode.FileType.File]]);
      jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ mtime: recentMtime } as vscode.FileStat);
      jest
        .spyOn(vscode.workspace.fs, 'readFile')
        .mockResolvedValue(encode({ codecoverage: [{ name: 'ClassA', coveredLines: [1], uncoveredLines: [2] }] }));

      await run(CodeCoverageService.applyForEditor(classADoc()));
      const populated = await run(CodeCoverageService.getRanges());
      expect(populated.coveredLines).toHaveLength(1);
      expect(populated.uncoveredLines).toHaveLength(1);

      const cleared = await run(CodeCoverageService.clear());
      expect(cleared).toEqual({ coveredLines: [], uncoveredLines: [] });
      expect(await run(CodeCoverageService.getRanges())).toEqual({ coveredLines: [], uncoveredLines: [] });
    });
  });

  describe('aggregation (restore-previous-results enabled by default)', () => {
    const classADoc = () => makeDocument('/workspace/project/force-app/main/default/classes/ClassA.cls');

    it('aggregates coverage from multiple recent files (most recent wins per class)', async () => {
      jest.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
        ['test-result-001.json', vscode.FileType.File],
        ['test-result-002.json', vscode.FileType.File]
      ]);
      jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ mtime: recentMtime } as vscode.FileStat);
      jest.spyOn(vscode.workspace.fs, 'readFile').mockImplementation((uri: URI) => {
        if (uri.path.endsWith('test-result-001.json')) {
          return Promise.resolve(
            encode({ codecoverage: [{ name: 'ClassA', coveredLines: [1], uncoveredLines: [2, 3] }] })
          );
        }
        return Promise.resolve(
          encode({ codecoverage: [{ name: 'ClassA', coveredLines: [1, 2, 3], uncoveredLines: [] }] })
        );
      });

      const ranges = await run(CodeCoverageService.applyForEditor(classADoc()));
      // File 002 wins: 3 covered lines, 0 uncovered
      expect(ranges.coveredLines).toHaveLength(3);
      expect(ranges.uncoveredLines).toHaveLength(0);
    });

    it('merges coverage from different classes across runs', async () => {
      jest.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
        ['test-result-001.json', vscode.FileType.File],
        ['test-result-002.json', vscode.FileType.File]
      ]);
      jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ mtime: recentMtime } as vscode.FileStat);
      jest.spyOn(vscode.workspace.fs, 'readFile').mockImplementation((uri: URI) => {
        if (uri.path.endsWith('test-result-001.json')) {
          return Promise.resolve(encode({ codecoverage: [{ name: 'ClassA', coveredLines: [1], uncoveredLines: [] }] }));
        }
        return Promise.resolve(
          encode({ codecoverage: [{ name: 'ClassB', coveredLines: [5, 6], uncoveredLines: [7] }] })
        );
      });

      const ranges = await run(
        CodeCoverageService.applyForEditor(makeDocument('/workspace/project/force-app/main/default/classes/ClassB.cls'))
      );
      expect(ranges.coveredLines).toHaveLength(2); // lines 5, 6
      expect(ranges.uncoveredLines).toHaveLength(1); // line 7
    });

    it('excludes files older than 24 hours', async () => {
      const oldMtime = now - 25 * 60 * 60 * 1000; // 25 hours ago
      jest.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
        ['test-result-001.json', vscode.FileType.File],
        ['test-result-002.json', vscode.FileType.File]
      ]);
      jest.spyOn(vscode.workspace.fs, 'stat').mockImplementation((uri: URI) =>
        Promise.resolve({
          mtime: uri.path.endsWith('test-result-001.json') ? oldMtime : recentMtime
        } as vscode.FileStat)
      );
      jest.spyOn(vscode.workspace.fs, 'readFile').mockImplementation((uri: URI) => {
        if (uri.path.endsWith('test-result-001.json')) {
          return Promise.resolve(
            encode({ codecoverage: [{ name: 'ClassA', coveredLines: [1], uncoveredLines: [2, 3, 4, 5] }] })
          );
        }
        return Promise.resolve(
          encode({ codecoverage: [{ name: 'ClassA', coveredLines: [1, 2, 3, 4, 5], uncoveredLines: [] }] })
        );
      });

      const ranges = await run(CodeCoverageService.applyForEditor(classADoc()));
      // Only file 002 (recent) used — 5 covered, 0 uncovered
      expect(ranges.coveredLines).toHaveLength(5);
      expect(ranges.uncoveredLines).toHaveLength(0);
    });

    it('excludes -codecoverage.json files from aggregation', async () => {
      jest.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
        ['test-result-001.json', vscode.FileType.File],
        ['test-result-001-codecoverage.json', vscode.FileType.File]
      ]);
      jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ mtime: recentMtime } as vscode.FileStat);
      const readFileSpy = jest.spyOn(vscode.workspace.fs, 'readFile').mockImplementation((uri: URI) => {
        if (uri.path.endsWith('test-result-001.json')) {
          return Promise.resolve(encode({ codecoverage: [{ name: 'ClassA', coveredLines: [1], uncoveredLines: [] }] }));
        }
        return Promise.reject(new Error(`unexpected read: ${uri.path}`));
      });

      await run(CodeCoverageService.applyForEditor(classADoc()));

      const readPaths = readFileSpy.mock.calls.map(([uri]) => (uri as URI).path);
      expect(readPaths.some(p => p.endsWith('-codecoverage.json'))).toBe(false);
    });
  });

  describe('restore-previous-results disabled', () => {
    const classADoc = () => makeDocument('/workspace/project/force-app/main/default/classes/ClassA.cls');

    it('only reads the most recent file', async () => {
      settingsValues.restorePrevious = false;
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
            encode({ codecoverage: [{ name: 'ClassA', coveredLines: [1, 2], uncoveredLines: [3] }] })
          );
        }
        return Promise.reject(new Error(`unexpected read: ${uri.path}`));
      });

      await run(CodeCoverageService.applyForEditor(classADoc()));

      expect(readCalls.some(p => p.endsWith('test-result-001.json'))).toBe(false);
      expect(readCalls.some(p => p.endsWith('test-result-002.json'))).toBe(true);
    });

    it('picks newest file by mtime when filenames are not chronologically sortable', async () => {
      settingsValues.restorePrevious = false;
      const olderMtime = now - 1000 * 60 * 60 * 2; // 2 hours ago
      const newerMtime = now - 1000 * 60; // 1 minute ago
      jest.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
        ['test-result-707xx0000099999.json', vscode.FileType.File], // alphabetically last, but older
        ['test-result-707xx0000011111.json', vscode.FileType.File] // alphabetically first, but newer
      ]);
      jest.spyOn(vscode.workspace.fs, 'stat').mockImplementation((uri: URI) =>
        Promise.resolve({
          mtime: uri.path.endsWith('test-result-707xx0000099999.json') ? olderMtime : newerMtime
        } as vscode.FileStat)
      );
      const readCalls: string[] = [];
      jest.spyOn(vscode.workspace.fs, 'readFile').mockImplementation((uri: URI) => {
        readCalls.push(uri.path);
        if (uri.path.endsWith('test-result-707xx0000011111.json')) {
          return Promise.resolve(
            encode({ codecoverage: [{ name: 'ClassA', coveredLines: [1, 2, 3], uncoveredLines: [] }] })
          );
        }
        return Promise.reject(new Error(`unexpected read: ${uri.path}`));
      });

      const ranges = await run(CodeCoverageService.applyForEditor(classADoc()));

      expect(readCalls.some(p => p.endsWith('test-result-707xx0000099999.json'))).toBe(false);
      expect(readCalls.some(p => p.endsWith('test-result-707xx0000011111.json'))).toBe(true);
      expect(ranges.coveredLines).toHaveLength(3);
      expect(ranges.uncoveredLines).toHaveLength(0);
    });
  });

  describe('tagged-error paths', () => {
    const classADoc = () => makeDocument('/workspace/project/force-app/main/default/classes/ClassA.cls');

    it('NoCoverageOnProjectError when results directory is empty', async () => {
      jest.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([]);
      const failure = await run(CodeCoverageService.applyForEditor(classADoc()).pipe(Effect.flip));
      expect(failure).toBeInstanceOf(NoCoverageOnProjectError);
    });

    it('NoCoverageOnProjectError when readDirectory fails', async () => {
      jest.spyOn(vscode.workspace.fs, 'readDirectory').mockRejectedValue(new Error('boom'));
      const failure = await run(CodeCoverageService.applyForEditor(classADoc()).pipe(Effect.flip));
      expect(failure).toBeInstanceOf(NoCoverageOnProjectError);
    });

    it('StaleResultsError when files exist but none contain coverage keys', async () => {
      jest
        .spyOn(vscode.workspace.fs, 'readDirectory')
        .mockResolvedValue([['test-result-001.json', vscode.FileType.File]]);
      jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ mtime: recentMtime } as vscode.FileStat);
      jest.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(encode({ tests: [{ outcome: 'Pass' }] }));

      const failure = await run(CodeCoverageService.applyForEditor(classADoc()).pipe(Effect.flip));
      expect(failure).toBeInstanceOf(StaleResultsError);
    });

    it('NoCoverageForFileError when no coverage entry matches the current file', async () => {
      jest
        .spyOn(vscode.workspace.fs, 'readDirectory')
        .mockResolvedValue([['test-result-001.json', vscode.FileType.File]]);
      jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ mtime: recentMtime } as vscode.FileStat);
      jest
        .spyOn(vscode.workspace.fs, 'readFile')
        .mockResolvedValue(encode({ codecoverage: [{ name: 'OtherClass', coveredLines: [1], uncoveredLines: [] }] }));

      const failure = await run(CodeCoverageService.applyForEditor(classADoc()).pipe(Effect.flip));
      expect(failure).toBeInstanceOf(NoCoverageForFileError);
    });

    it('OutOfSyncCoverageError when a coverage line is outside the document range', async () => {
      const doc = makeDocument('/workspace/project/force-app/main/default/classes/ClassA.cls');
      (doc.lineAt as jest.Mock).mockImplementation(() => {
        throw new Error('line out of range');
      });
      jest
        .spyOn(vscode.workspace.fs, 'readDirectory')
        .mockResolvedValue([['test-result-001.json', vscode.FileType.File]]);
      jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ mtime: recentMtime } as vscode.FileStat);
      jest
        .spyOn(vscode.workspace.fs, 'readFile')
        .mockResolvedValue(encode({ codecoverage: [{ name: 'ClassA', coveredLines: [999], uncoveredLines: [] }] }));

      const failure = await run(CodeCoverageService.applyForEditor(doc).pipe(Effect.flip));
      expect(failure).toBeInstanceOf(OutOfSyncCoverageError);
    });
  });

  describe('handleCoverageException routing', () => {
    it('appends to channel when disable-warnings is enabled', async () => {
      settingsValues.disableWarnings = true;
      await run(CodeCoverageService.handleCoverageException(new StaleResultsError({ message: 'no coverage' })));
      expect(mockAppendToChannel).toHaveBeenCalledWith('no coverage');
    });

    it('shows a warning message when disable-warnings is disabled', async () => {
      settingsValues.disableWarnings = false;
      const showWarning = jest
        .spyOn(vscode.window, 'showWarningMessage')
        .mockResolvedValue(undefined as unknown as vscode.MessageItem);
      await run(CodeCoverageService.handleCoverageException(new StaleResultsError({ message: 'no coverage' })));
      expect(showWarning).toHaveBeenCalled();
      expect(mockAppendToChannel).not.toHaveBeenCalled();
    });
  });
});
