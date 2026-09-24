/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

type MockFunction = (...args: any[]) => any;
type MockFactory = (implementation?: MockFunction) => any;
type MockedFunction<T extends MockFunction> = T & ReturnType<MockFactory>;

/** Creates the runner-neutral, inert VS Code unit-test mock. */
export const createVSCodeMock = (mockFunction: MockFactory) => {
  class EventEmitter {
    private listeners: any[] = [];
    constructor() {}
    public event = (listener: any) => this.listeners.push(listener);
    public dispose = mockFunction();
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

    public static parse = mockFunction() as MockedFunction<(value: string) => Uri>;

    public static file = mockFunction((path: string): Uri => new Uri('file', '', path, '', '')) as MockedFunction<
      (path: string) => Uri
    >;

    public static joinPath = mockFunction((...paths: string[]): Uri => {
      const joined = paths.join('/');
      return new Uri('file', '', joined, '', '');
    }) as MockedFunction<(...paths: string[]) => Uri>;

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

    public with(change: {
      scheme?: string;
      authority?: string;
      path?: string;
      query?: string;
      fragment?: string;
    }): Uri {
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
    id: mockFunction(),
    name: mockFunction(),
    selector: mockFunction(),
    severity: mockFunction(),
    text: mockFunction(),
    detail: mockFunction(),
    busy: mockFunction(),
    command: mockFunction(),
    accessibilityInformation: mockFunction()
  };

  const mockCreateLanguageStatusItem = mockFunction();
  mockCreateLanguageStatusItem.mockReturnValue(mockLanguageStatusItem);

  const LanguageStatusSeverity = { Information: 0, Warning: 1, Error: 2 } as const;

  const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 } as const;

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
      TreeItem: mockFunction(),
      commands: {
        executeCommand: mockFunction().mockResolvedValue(undefined),
        registerCommand: mockFunction()
      },
      Disposable: mockFunction(),
      env: {
        machineId: '12345534',
        sessionId: 'test-session',
        appName: 'Visual Studio Code',
        language: 'en',
        createTelemetryLogger: mockFunction().mockReturnValue({
          logUsage: mockFunction(),
          logError: mockFunction(),
          dispose: mockFunction(),
          onDidChangeEnableStates: mockFunction()
        })
      },
      EventEmitter,
      ExtensionMode: { Production: 1, Development: 2, Test: 3 },
      UIKind: { Desktop: 1, Web: 2 },
      version: '1.0.0-test',
      extensions: {
        getExtension: mockFunction()
      },
      languages: {
        createDiagnosticCollection: mockFunction(),
        createLanguageStatusItem: mockCreateLanguageStatusItem,
        registerCodeLensProvider: mockFunction().mockReturnValue({ dispose: mockFunction() })
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
      TestRunRequest: class {
        constructor(
          public include?: readonly unknown[],
          public exclude?: readonly unknown[],
          public profile?: unknown,
          public continuous?: boolean
        ) {}
      },
      StatusBarAlignment: {
        Left: 1,
        Right: 2
      },
      QuickPickItemKind: {
        Separator: -1,
        Default: 0
      },
      ThemeColor: mockFunction(),
      window: {
        activeTextEditor: mockFunction(),
        onDidChangeActiveTextEditor: mockFunction(() => ({
          dispose: mockFunction()
        })),
        showInformationMessage: mockFunction(),
        showWarningMessage: mockFunction(),
        showErrorMessage: mockFunction(),
        showQuickPick: mockFunction(),
        showInputBox: mockFunction(),
        setStatusBarMessage: mockFunction(),
        showWarningModal: mockFunction(),
        withProgress: mockFunction(),
        createOutputChannel: mockFunction(() => ({
          clear: mockFunction(),
          appendLine: mockFunction(),
          show: mockFunction()
        })),
        showSaveDialog: mockFunction(),
        showTextDocument: mockFunction(),
        OutputChannel: {
          show: mockFunction()
        },
        createStatusBarItem: mockFunction(),
        createTextEditorDecorationType: mockFunction()
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
          update: mockFunction(),
          inspect: () => undefined
        }),
        onDidChangeConfiguration: mockFunction(),
        findFiles: mockFunction().mockResolvedValue([]),
        createFileSystemWatcher: mockFunction().mockReturnValue({
          onDidChange: mockFunction().mockReturnValue({ dispose: mockFunction() }),
          onDidCreate: mockFunction().mockReturnValue({ dispose: mockFunction() }),
          onDidDelete: mockFunction().mockReturnValue({ dispose: mockFunction() }),
          dispose: mockFunction()
        }),
        workspaceFolders: [],
        textDocuments: [],
        openTextDocument: mockFunction().mockResolvedValue({
          getText: mockFunction().mockReturnValue(''),
          positionAt: mockFunction().mockReturnValue({ line: 0, character: 0 }),
          uri: { toString: mockFunction().mockReturnValue('file:///test') }
        }),
        fs: {
          writeFile: mockFunction(),
          stat: mockFunction(),
          createDirectory: mockFunction(),
          copy: mockFunction(),
          delete: mockFunction(),
          readFile: mockFunction(),
          readDirectory: mockFunction(),
          rename: mockFunction()
        },
        registerTextDocumentContentProvider: mockFunction(),
        registerFileSystemProvider: mockFunction()
      },
      CompletionItem: class {
        public insertText?: unknown;
        public detail?: string;
        constructor(
          public label: string,
          public kind?: number
        ) {}
      },
      CompletionItemKind: {
        Class: 7,
        Field: 5,
        Snippet: 14,
        Value: 12
      },
      SnippetString: class {
        constructor(public value: string) {}
      },
      CodeLens: class {
        public range: any;
        public command?: any;
        constructor(range: any, command?: any) {
          this.range = range;
          this.command = command;
        }
      },
      TabInputText: class {
        public uri: unknown;
        constructor(uri: unknown) {
          this.uri = uri;
        }
      },
      TabInputTextDiff: class {
        public original: unknown;
        public modified: unknown;
        constructor(original: unknown, modified: unknown) {
          this.original = original;
          this.modified = modified;
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
      FilePermission: {
        Readonly: 1
      },
      FileChangeType: {
        Changed: 1,
        Created: 2,
        Deleted: 3
      },
      FileSystemError: class FileSystemError extends Error {
        public readonly code: string;
        constructor(messageOrUri?: string | Uri, code: string = 'Unknown') {
          super(typeof messageOrUri === 'string' ? messageOrUri : String(messageOrUri ?? ''));
          this.name = 'FileSystemError';
          this.code = code;
        }
        static FileNotFound(messageOrUri?: string | Uri) {
          return new this(messageOrUri, 'FileNotFound');
        }
        static FileExists(messageOrUri?: string | Uri) {
          return new this(messageOrUri, 'FileExists');
        }
        static FileNotADirectory(messageOrUri?: string | Uri) {
          return new this(messageOrUri, 'FileNotADirectory');
        }
        static FileIsADirectory(messageOrUri?: string | Uri) {
          return new this(messageOrUri, 'FileIsADirectory');
        }
        static NoPermissions(messageOrUri?: string | Uri) {
          return new this(messageOrUri, 'NoPermissions');
        }
        static Unavailable(messageOrUri?: string | Uri) {
          return new this(messageOrUri, 'Unavailable');
        }
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
        createTestController: mockFunction()
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
      CustomExecution: class {
        public callback: any;
        constructor(callback: any) {
          this.callback = callback;
        }
      },
      tasks: {
        executeTask: mockFunction(),
        onDidStartTask: mockFunction(() => ({ dispose: mockFunction() })),
        onDidEndTask: mockFunction(() => ({ dispose: mockFunction() })),
        onDidEndTaskProcess: mockFunction(() => ({ dispose: mockFunction() }))
      }
    };

    return vscodeMock;
  };

  return getMockVSCode();
};
