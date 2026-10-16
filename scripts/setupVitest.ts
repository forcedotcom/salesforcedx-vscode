/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { beforeEach, vi } from 'vitest';
import { createVSCodeMock } from './vscodeMock';

// Azure Monitor exporter ctor starts a 15s Statsbeat timer that imports after test teardown.
process.env.APPLICATION_INSIGHTS_NO_STATSBEAT = 'true';

const vscodeMock = createVSCodeMock(vi.fn);

export const {
  CancellationTokenSource,
  ConfigurationTarget,
  TreeItem,
  commands,
  Disposable,
  env,
  EventEmitter: VSCodeEventEmitter,
  ExtensionMode,
  UIKind,
  version,
  extensions,
  languages,
  Uri: VSCodeUri,
  Position,
  ProgressLocation,
  Range,
  RelativePattern,
  Location,
  TestMessage,
  TestTag,
  TestItem,
  TestRunRequest,
  StatusBarAlignment,
  QuickPickItemKind,
  ThemeColor,
  window,
  ViewColumn,
  TextEditorRevealType,
  Selection,
  workspace,
  CompletionItem,
  CompletionItemKind,
  SnippetString,
  CodeLens,
  TabInputText,
  TabInputTextDiff,
  DocumentLink,
  CodeAction,
  Diagnostic,
  FileType,
  FilePermission,
  FileChangeType,
  FileSystemError,
  CallHierarchyItem,
  TypeHierarchyItem,
  SymbolInformation,
  InlayHint,
  CancellationError,
  LanguageStatusSeverity: VSCodeLanguageStatusSeverity,
  TreeItemCollapsibleState: VSCodeTreeItemCollapsibleState,
  SymbolKind,
  tests,
  TestRunProfileKind,
  TaskRevealKind,
  TaskPanelKind,
  TaskScope,
  ShellExecution,
  Task,
  CustomExecution,
  tasks
} = vscodeMock;

export {
  VSCodeEventEmitter as EventEmitter,
  VSCodeLanguageStatusSeverity as LanguageStatusSeverity,
  VSCodeTreeItemCollapsibleState as TreeItemCollapsibleState,
  VSCodeUri as Uri
};
export default vscodeMock;

beforeEach(() => {
  // mockReset=true wipes mock implementations, so re-apply default mocks here.
  // Tests that need specific mocks should provide their own via Effect layers.
  vscodeMock.extensions.getExtension.mockImplementation(() => undefined);
  vscodeMock.commands.executeCommand.mockResolvedValue(undefined);
});

// Mock os module to ensure homedir() always returns a valid path
vi.doMock('node:os', async () => ({
  ...(await vi.importActual<typeof import('node:os')>('node:os')),
  homedir: vi.fn(() => '/tmp')
}));

// Also mock the legacy 'os' import
vi.doMock('os', async () => ({
  ...(await vi.importActual<typeof import('node:os')>('node:os')),
  homedir: vi.fn(() => '/tmp')
}));
