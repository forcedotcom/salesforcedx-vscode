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

  public constructor(scheme: string, authority: string, path: string, query: string, fragment: string) {
    this.scheme = scheme;
    this.authority = authority;
    this.path = path;
    this.query = query;
    this.fragment = fragment;
  }

  public static parse(value: string): Uri {
    // Simplified parsing for testing purposes
    // Handles both Unix and Windows paths, as well as custom schemes like sf-org-apex
    // Examples:
    // - file:///C:/Users/path (Windows file URI with three slashes)
    // - file:///home/path (Unix file URI)
    // - sf-org-apex:ClassName (custom scheme)

    // Handle file:/// URIs (both Windows and Unix)
    if (value.startsWith('file:///')) {
      const path = value.substring(7); // Remove 'file:///'
      const queryIndex = path.indexOf('?');
      const fragmentIndex = path.indexOf('#');
      const endIndex =
        queryIndex >= 0 && fragmentIndex >= 0
          ? Math.min(queryIndex, fragmentIndex)
          : queryIndex >= 0
            ? queryIndex
            : fragmentIndex >= 0
              ? fragmentIndex
              : path.length;
      const filePath = path.substring(0, endIndex);
      const query =
        queryIndex >= 0 ? path.substring(queryIndex + 1, fragmentIndex >= 0 ? fragmentIndex : path.length) : '';
      const fragment = fragmentIndex >= 0 ? path.substring(fragmentIndex + 1) : '';
      return new Uri('file', '', filePath, query, fragment);
    }

    // Handle file:// URIs (with authority)
    if (value.startsWith('file://')) {
      const afterScheme = value.substring(7); // Remove 'file://'
      const slashIndex = afterScheme.indexOf('/');
      if (slashIndex >= 0) {
        const authority = afterScheme.substring(0, slashIndex);
        const pathAndRest = afterScheme.substring(slashIndex);
        const queryIndex = pathAndRest.indexOf('?');
        const fragmentIndex = pathAndRest.indexOf('#');
        const endIndex =
          queryIndex >= 0 && fragmentIndex >= 0
            ? Math.min(queryIndex, fragmentIndex)
            : queryIndex >= 0
              ? queryIndex
              : fragmentIndex >= 0
                ? fragmentIndex
                : pathAndRest.length;
        const path = pathAndRest.substring(0, endIndex);
        const query =
          queryIndex >= 0
            ? pathAndRest.substring(queryIndex + 1, fragmentIndex >= 0 ? fragmentIndex : pathAndRest.length)
            : '';
        const fragment = fragmentIndex >= 0 ? pathAndRest.substring(fragmentIndex + 1) : '';
        return new Uri('file', authority, path, query, fragment);
      }
    }

    // Match scheme:path or scheme://authority/path
    const parts = value.match(/^([^:]+):(\/\/)?([^/?#]*)([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/);
    if (parts) {
      const scheme = parts[1];
      const hasSlashes = parts[2]; // '//' or undefined
      const authorityOrPath = parts[3] || '';
      const restOfPath = parts[4] || '';

      // For schemes with //, authority is before first /
      if (hasSlashes) {
        const authority = authorityOrPath;
        const path = restOfPath || '/';
        return new Uri(scheme, authority, path, parts[5] || '', parts[6] || '');
      }

      // Simple scheme:path format (e.g., sf-org-apex:ClassName)
      return new Uri(
        scheme,
        '', // no authority
        authorityOrPath + restOfPath, // path is everything after the colon
        parts[5] || '', // query
        parts[6] || '' // fragment
      );
    }
    return new Uri('', '', value, '', ''); // Fallback for simple paths
  }

  public static file(path: string): Uri {
    // Normalize Windows backslashes to forward slashes for URI compatibility
    // This matches VS Code's behavior where file URIs always use forward slashes
    const normalizedPath = path.replace(/\\/g, '/');
    // Ensure path starts with / for absolute paths
    const uriPath = normalizedPath.match(/^[A-Z]:/i)
      ? `/${normalizedPath}` // Windows drive letter: C:/path -> /C:/path
      : normalizedPath.startsWith('/')
        ? normalizedPath
        : `/${normalizedPath}`; // Ensure leading slash for absolute paths
    return new Uri('file', '', uriPath, '', '');
  }

  public static joinPath(...paths: string[]): Uri {
    const joined = paths.join('/');
    return new Uri('file', '', joined, '', '');
  }

  public toString(skipEncoding?: boolean): string {
    const auth = this.authority ? `//${this.authority}` : '';
    const query = this.query ? `?${this.query}` : '';
    const fragment = this.fragment ? `#${this.fragment}` : '';
    return `${this.scheme}:${auth}${this.path}${query}${fragment}`;
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
    Uri,
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
      public constructor(anchor: any, active: any) {
        this.anchor = anchor;
        this.active = active;
      }
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
