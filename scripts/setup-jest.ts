/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
class EventEmitter {
  private listeners: any[] = [];
  constructor() {}
  public event = (listener: any) => this.listeners.push(listener);
  public dispose = jest.fn();
  public fire = (e: any) => this.listeners.forEach(listener => listener(e));
}

class Uri {
  public scheme: string;
  public authority: string;
  public path: string;
  public query: string;
  public fragment: string;

  constructor(scheme: string, authority: string, path: string, query: string, fragment: string) {
    this.scheme = scheme;
    this.authority = authority;
    this.path = path;
    this.query = query;
    this.fragment = fragment;
  }

  public static parse = jest.fn() as jest.MockedFunction<(value: string) => Uri>;

  public static file = jest.fn((path: string): Uri => new Uri('file', '', path, '', '')) as jest.MockedFunction<
    (path: string) => Uri
  >;

  public static joinPath = jest.fn((...paths: string[]): Uri => {
    const joined = paths.join('/');
    return new Uri('file', '', joined, '', '');
  }) as jest.MockedFunction<(...paths: string[]) => Uri>;

  public toString(skipEncoding?: boolean): string {
    const auth = this.authority ? `//${this.authority}` : '';
    const query = this.query ? `?${this.query}` : '';
    const fragment = this.fragment ? `#${this.fragment}` : '';
    return `${this.scheme}:${auth}${this.path}${query}${fragment}`;
  }

  // Add fsPath property for compatibility with VS Code Uri
  public get fsPath(): string {
    if (this.scheme === 'file') {
      // For file URIs, return the path (handles both Unix and Windows)
      return this.path;
    }
    return this.path;
  }

  public with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri {
    return new Uri(
      change.scheme ?? this.scheme,
      change.authority ?? this.authority,
      change.path ?? this.path,
      change.query ?? this.query,
      change.fragment ?? this.fragment
    );
  }

  public toJSON(): any {
    return {
      scheme: this.scheme,
      authority: this.authority,
      path: this.path,
      query: this.query,
      fragment: this.fragment
    };
  }
}

const mockLanguageStatusItem = {
  id: jest.fn(),
  name: jest.fn(),
  selector: jest.fn(),
  severity: jest.fn(),
  text: jest.fn(),
  detail: jest.fn(),
  busy: jest.fn(),
  command: jest.fn(),
  accessibilityInformation: jest.fn()
};

const mockCreateLanguageStatusItem = jest.fn();
mockCreateLanguageStatusItem.mockReturnValue(mockLanguageStatusItem);

enum LanguageStatusSeverity {
  Information = 0,
  Warning = 1,
  Error = 2
}

enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2
}

const getMockVSCode = () => {
  const vscodeMock: any = {
    CancellationTokenSource: class {
      public listeners: any[] = [];
      public token = {
        isCancellationRequested: false,
        onCancellationRequested: (listener: any) => {
          this.listeners.push(listener);
          return {
            dispose: () => {
              this.listeners = [];
            }
          };
        }
      };
      public cancel = () => {
        this.listeners.forEach(listener => {
          listener.call();
        });
      };
      public dispose = () => {};
    },
    ConfigurationTarget: {
      Global: 1,
      Workspace: 2,
      WorkspaceFolder: 3
    },
    TreeItem: jest.fn(),
    commands: {
      executeCommand: jest.fn().mockResolvedValue(undefined),
      registerCommand: jest.fn()
    },
    Disposable: jest.fn(),
    env: {
      machineId: '12345534',
      appName: 'Visual Studio Code',
      createTelemetryLogger: jest.fn().mockReturnValue({
        logUsage: jest.fn(),
        logError: jest.fn(),
        dispose: jest.fn(),
        onDidChangeEnableStates: jest.fn()
      })
    },
    EventEmitter,
    ExtensionMode: { Production: 1, Development: 2, Test: 3 },
    extensions: {
      getExtension: jest.fn()
    },
    languages: {
      createDiagnosticCollection: jest.fn(),
      createLanguageStatusItem: mockCreateLanguageStatusItem,
      registerCodeLensProvider: jest.fn().mockReturnValue({ dispose: jest.fn() })
    },
    Uri: {
      ...Uri,
      parse: Uri.parse,
      file: Uri.file,
      joinPath: Uri.joinPath
    },
    Position: class {
      constructor(
        public line: number,
        public character: number
      ) {}
    },
    ProgressLocation: {
      SourceControl: 1,
      Window: 10,
      Notification: 15
    },
    Range: class {
      public start: any;
      public end: any;
      constructor(startOrLine: any, startCharOrEnd?: any, endLine?: any, endChar?: any) {
        // Support both forms: Range(start, end) and Range(startLine, startChar, endLine, endChar)
        if (endLine !== undefined && endChar !== undefined) {
          // 4-parameter form: Range(startLine, startChar, endLine, endChar)
          this.start = new (getMockVSCode().Position)(startOrLine, startCharOrEnd);
          this.end = new (getMockVSCode().Position)(endLine, endChar);
        } else {
          // 2-parameter form: Range(start, end)
          this.start = startOrLine;
          this.end = startCharOrEnd;
        }
      }
    },
    RelativePattern: class {
      constructor(
        public base: any,
        public pattern: string
      ) {}
    },
    Location: class {
      constructor(
        public uri: Uri,
        public range: Range
      ) {}
    },
    TestMessage: class {
      public message: string;
      public location?: Location;
      constructor(message: string) {
        this.message = message;
        this.location = undefined;
      }
    },
    TestTag: class {
      public id: string;
      constructor(id: string) {
        this.id = id;
      }
    },
    TestItem: class {
      public label: string;
      public uri?: Uri;
      constructor(label: string, uri?: Uri) {
        this.label = label;
        this.uri = uri;
      }
    },
    StatusBarAlignment: {
      Left: 1,
      Right: 2
    },
    ThemeColor: jest.fn(),
    window: {
      activeTextEditor: jest.fn(),
      onDidChangeActiveTextEditor: jest.fn(() => ({
        dispose: jest.fn()
      })),
      showInformationMessage: jest.fn(),
      showWarningMessage: jest.fn(),
      showErrorMessage: jest.fn(),
      showQuickPick: jest.fn(),
      showInputBox: jest.fn(),
      setStatusBarMessage: jest.fn(),
      showWarningModal: jest.fn(),
      withProgress: jest.fn(),
      createOutputChannel: jest.fn(() => ({
        clear: jest.fn(),
        appendLine: jest.fn(),
        show: jest.fn()
      })),
      showSaveDialog: jest.fn(),
      showTextDocument: jest.fn(),
      OutputChannel: {
        show: jest.fn()
      },
      createStatusBarItem: jest.fn(),
      createTextEditorDecorationType: jest.fn()
    },
    ViewColumn: {
      Active: -1,
      One: 1,
      Two: 2,
      Three: 3,
      Four: 4,
      Five: 5,
      Six: 6,
      Seven: 7,
      Eight: 8,
      Nine: 9,
      Beside: -2
    },
    TextEditorRevealType: {
      Default: 0,
      InCenter: 1,
      InCenterIfOutsideViewport: 2,
      AtTop: 3
    },
    Selection: class {
      public anchor: any;
      public active: any;
      constructor(anchor: any, active: any) {
        this.anchor = anchor;
        this.active = active;
      }
    },
    workspace: {
      getConfiguration: () => ({
        get: () => true,
        update: jest.fn()
      }),
      onDidChangeConfiguration: jest.fn(),
      findFiles: jest.fn().mockResolvedValue([]),
      createFileSystemWatcher: jest.fn().mockReturnValue({
        onDidChange: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        onDidCreate: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        onDidDelete: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        dispose: jest.fn()
      }),
      workspaceFolders: [],
      textDocuments: [],
      openTextDocument: jest.fn().mockResolvedValue({
        getText: jest.fn().mockReturnValue(''),
        positionAt: jest.fn().mockReturnValue({ line: 0, character: 0 }),
        uri: { toString: jest.fn().mockReturnValue('file:///test') }
      }),
      fs: {
        writeFile: jest.fn(),
        stat: jest.fn(),
        createDirectory: jest.fn(),
        delete: jest.fn(),
        readFile: jest.fn(),
        readDirectory: jest.fn(),
        rename: jest.fn()
      },
      registerTextDocumentContentProvider: jest.fn(),
      registerFileSystemProvider: jest.fn()
    },
    CompletionItem: class {
      constructor(label: string) {}
    },
    CodeLens: class {
      public range: any;
      public command?: any;
      constructor(range: any, command?: any) {
        this.range = range;
        this.command = command;
      }
    },
    DocumentLink: class {
      constructor(range: Range, target?: Uri) {}
    },
    CodeAction: class {
      constructor(title: string, data?: any) {}
    },
    Diagnostic: class {
      constructor(range: Range, message: string, severity?: any) {}
    },
    FileType: {
      File: 1,
      Directory: 2
    },
    CallHierarchyItem: class {
      constructor(kind: any, name: string, detail: string, uri: Uri, range: Range, selectionRange: Range) {}
    },
    TypeHierarchyItem: class {
      constructor(kind: any, name: string, detail: string, uri: Uri, range: Range, selectionRange: Range) {}
    },
    SymbolInformation: class {
      constructor(name: string, kind: any, range: Range, uri?: Uri, containerName?: string) {}
    },
    InlayHint: class {
      constructor(position: any, label: any, kind?: any) {}
    },
    CancellationError: class {
      constructor() {}
    },
    LanguageStatusSeverity,
    TreeItemCollapsibleState,
    SymbolKind: {
      File: 0,
      Module: 1,
      Namespace: 2,
      Package: 3,
      Class: 5,
      Method: 6,
      Property: 7,
      Field: 8,
      Constructor: 9,
      Enum: 10,
      Interface: 11,
      Function: 12,
      Variable: 13,
      Constant: 14,
      String: 15,
      Number: 16,
      Boolean: 17,
      Array: 18,
      Object: 19,
      Key: 20,
      Null: 21,
      EnumMember: 22,
      Struct: 23,
      Event: 24,
      Operator: 25,
      TypeParameter: 26
    },
    tests: {
      createTestController: jest.fn()
    },
    TestRunProfileKind: {
      Run: 1,
      Debug: 2,
      Coverage: 3
    },
    TaskRevealKind: {
      Always: 1,
      Silent: 2,
      Never: 3
    },
    TaskPanelKind: {
      Shared: 1,
      Dedicated: 2,
      New: 3
    },
    TaskScope: {
      Global: 1,
      Workspace: 2
    },
    ShellExecution: class {
      public commandLine: string;
      public options?: any;
      constructor(commandOrCommandLine: string, argsOrOptions?: any, options?: any) {
        // ShellExecution(command, args, options) | ShellExecution(commandLine, options)
        this.commandLine = commandOrCommandLine;
        this.options = Array.isArray(argsOrOptions) ? options : argsOrOptions;
      }
    },
    Task: class {
      public definition: any;
      public scope: any;
      public name: string;
      public source: string;
      public execution: any;
      public presentationOptions: any;
      public isBackground = false;
      public problemMatchers: string[] = [];
      public runOptions: any = {};
      constructor(
        definition: any,
        scope: any,
        name: string,
        source: string,
        execution?: any,
        problemMatchers?: string[]
      ) {
        this.definition = definition;
        this.scope = scope;
        this.name = name;
        this.source = source;
        this.execution = execution;
        this.problemMatchers = problemMatchers || [];
      }
    },
    tasks: {
      executeTask: jest.fn(),
      onDidStartTask: jest.fn(() => ({ dispose: jest.fn() })),
      onDidEndTask: jest.fn(() => ({ dispose: jest.fn() }))
    }
  };

  return vscodeMock;
};

jest.mock('vscode', () => getMockVSCode(), { virtual: true });

beforeEach(() => {
  // resetMocks=true wipes mock implementations, so re-apply default mocks here.
  // Tests that need specific mocks should provide their own via Effect layers.
  const vscodeMock: any = jest.requireMock('vscode');
  vscodeMock?.extensions?.getExtension?.mockImplementation?.(() => undefined);
  vscodeMock?.commands?.executeCommand?.mockResolvedValue?.(undefined);
});

// Mock os module to ensure homedir() always returns a valid path
jest.mock('node:os', () => ({
  ...jest.requireActual('node:os'),
  homedir: jest.fn(() => '/tmp')
}));

// Also mock the legacy 'os' import
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: jest.fn(() => '/tmp')
}));
