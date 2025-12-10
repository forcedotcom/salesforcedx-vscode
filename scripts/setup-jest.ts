class EventEmitter {
  private listeners: any[] = [];
  constructor() {}
  public event = (listener: any) => this.listeners.push(listener);
  public dispose = jest.fn();
  public fire = (e: any) => this.listeners.forEach(listener => listener(e));
}

class Uri {
  public static parse = jest.fn();
  public static file = jest.fn();
  public static joinPath = jest.fn();
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
  return {
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
      executeCommand: jest.fn()
    },
    Disposable: jest.fn(),
    env: {
      machineId: '12345534',
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
      createLanguageStatusItem: mockCreateLanguageStatusItem
    },
    Uri: {
      file: jest.fn(),
      joinPath: jest.fn(),
      parse: jest.fn(),
      toString: jest.fn()
    },
    Position: class {
      public constructor(
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
      public constructor(startOrLine: any, startCharOrEnd?: any, endLine?: any, endChar?: any) {
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
      public constructor(
        public base: any,
        public pattern: string
      ) {}
    },
    Location: class {
      public constructor(
        public uri: Uri,
        public range: Range
      ) {}
    },
    TestMessage: class {
      public message: string;
      public location?: Location;
      public constructor(message: string) {
        this.message = message;
        this.location = undefined;
      }
    },
    TestTag: class {
      public id: string;
      public constructor(id: string) {
        this.id = id;
      }
    },
    TestItem: class {
      public label: string;
      public uri?: Uri;
      public constructor(label: string, uri?: Uri) {
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
      OutputChannel: {
        show: jest.fn()
      },
      createStatusBarItem: jest.fn(),
      createTextEditorDecorationType: jest.fn()
    },
    workspace: {
      getConfiguration: () => {
        return {
          get: () => true,
          update: jest.fn()
        };
      },
      onDidChangeConfiguration: jest.fn(),
      findFiles: jest.fn().mockResolvedValue([]),
      createFileSystemWatcher: jest.fn().mockReturnValue({
        onDidChange: jest.fn(),
        onDidCreate: jest.fn(),
        onDidDelete: jest.fn()
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
      public constructor(label: string) {}
    },
    CodeLens: class {
      public constructor(range: Range) {}
    },
    DocumentLink: class {
      public constructor(range: Range, target?: Uri) {}
    },
    CodeAction: class {
      public constructor(title: string, data?: any) {}
    },
    Diagnostic: class {
      public constructor(range: Range, message: string, severity?: any) {}
    },
    FileType: {
      File: 1,
      Directory: 2
    },
    CallHierarchyItem: class {
      public constructor(kind: any, name: string, detail: string, uri: Uri, range: Range, selectionRange: Range) {}
    },
    TypeHierarchyItem: class {
      public constructor(kind: any, name: string, detail: string, uri: Uri, range: Range, selectionRange: Range) {}
    },
    SymbolInformation: class {
      public constructor(name: string, kind: any, range: Range, uri?: Uri, containerName?: string) {}
    },
    InlayHint: class {
      public constructor(position: any, label: any, kind?: any) {}
    },
    CancellationError: class {
      public constructor() {}
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
    }
  };
};

jest.mock(
  'vscode',
  () => {
    return getMockVSCode();
  },
  { virtual: true }
);

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
