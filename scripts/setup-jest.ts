class EventEmitter {
  private listeners: any[] = [];
  constructor() {}
  public event = (listener: any) => this.listeners.push(listener);
  public dispose = jest.fn();
  public fire = (e: any) => this.listeners.forEach(listener => listener(e));
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
    commands: jest.fn(),
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
      createDiagnosticCollection: jest.fn()
    },
    Uri: {
      parse: jest.fn(),
      file: jest.fn(),
      joinPath: jest.fn()
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
    window: {
      activeTextEditor: jest.fn(),
      showInformationMessage: jest.fn(),
      showWarningMessage: jest.fn(),
      showErrorMessage: jest.fn(),
      showInputBox: jest.fn(),
      setStatusBarMessage: jest.fn(),
      withProgress: jest.fn(),
      createOutputChannel: jest.fn(),
      OutputChannel: {
        show: jest.fn()
      },
      createStatusBarItem: jest.fn()
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
      workspaceFolders: []
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
