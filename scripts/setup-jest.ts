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
    TreeItem: jest.fn(),
    commands: {
      executeCommand: jest.fn()
    },
    Disposable: jest.fn(),
    env: {
      machineId: '12345534'
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
      parse: jest.fn()
    },
    Position: jest.fn(),
    ProgressLocation: {
      SourceControl: 1,
      Window: 10,
      Notification: 15
    },
    Range: jest.fn(),
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
      createOutputChannel: jest.fn(),
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
      createFileSystemWatcher: jest.fn().mockReturnValue({
        onDidChange: jest.fn(),
        onDidCreate: jest.fn(),
        onDidDelete: jest.fn()
      }),
      workspaceFolders: [],
      fs: {
        writeFile: jest.fn(),
        stat: jest.fn(),
        createDirectory: jest.fn(),
        delete: jest.fn(),
        readFile: jest.fn(),
        readDirectory: jest.fn()
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
    TreeItemCollapsibleState
  };
};

jest.mock(
  'vscode',
  () => {
    return getMockVSCode();
  },
  { virtual: true }
);
