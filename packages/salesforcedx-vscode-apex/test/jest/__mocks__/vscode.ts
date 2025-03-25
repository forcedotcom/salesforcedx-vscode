/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const vscode = {
  languages: {
    createLanguageStatusItem: jest.fn().mockReturnValue({
      text: '',
      severity: 2,
      command: undefined,
      dispose: jest.fn()
    }),
    createDiagnosticCollection: jest.fn().mockReturnValue({
      set: jest.fn()
    })
  },
  Uri: {
    file: jest.fn()
  },
  LanguageStatusSeverity: {
    Error: 1,
    Information: 2
  },
  DiagnosticSeverity: {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3
  },
  Position: class {
    constructor(
      public line: number,
      public character: number
    ) {}
  },
  Range: class {
    constructor(
      public start: any,
      public end: any
    ) {}
  },
  Diagnostic: class {
    constructor(
      public range: any,
      public message: string,
      public severity: number
    ) {}
  },
  workspace: {
    workspaceFolders: undefined,
    createFileSystemWatcher: jest.fn().mockReturnValue({
      onDidCreate: jest.fn(),
      onDidChange: jest.fn(),
      onDidDelete: jest.fn(),
      dispose: jest.fn()
    })
  },
  window: {
    registerTreeDataProvider: jest.fn()
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
  },
  Disposable: {
    from: (...items: any[]) => ({
      dispose: jest.fn()
    })
  },
  extensions: {
    getExtension: jest.fn()
  }
};

module.exports = vscode;
