/*
 * Shared VSCode mock for all packages in the salesforcedx-vscode monorepo
 * This mock provides comprehensive VSCode API coverage for Jest testing
 */
const fs = require('node:fs');

class EventEmitter {
  constructor() {
    this.listeners = [];
  }
  event = listener => this.listeners.push(listener);
  dispose = jest.fn();
  fire = e => this.listeners.forEach(listener => listener(e));
}

class Uri {
  static parse = jest.fn();
  static file = jest.fn();
  static joinPath = jest.fn();
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

const LanguageStatusSeverity = {
  Information: 0,
  Warning: 1,
  Error: 2
};

const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2
};

const vscode = {
  // Core classes
  CancellationTokenSource: class {
    constructor() {
      this.listeners = [];
    }
    token = {
      isCancellationRequested: false,
      onCancellationRequested: listener => {
        this.listeners.push(listener);
        return {
          dispose: () => {
            this.listeners = [];
          }
        };
      }
    };
    cancel = () => {
      this.listeners.forEach(listener => {
        listener.call();
      });
    };
    dispose = () => {};
  },
  TreeItem: jest.fn(),
  Disposable: jest.fn(),
  EventEmitter,
  ExtensionMode: { Production: 1, Development: 2, Test: 3 },

  // Uri implementation with actual file path support
  Uri: {
    file: filePath => ({ fsPath: filePath }),
    parse: uri => ({ fsPath: uri.replace('file://', '') }),
    joinPath: jest.fn()
  },

  // Position and Range
  Position: jest.fn(),
  Range: jest.fn(),

  // Enums
  ProgressLocation: {
    SourceControl: 1,
    Window: 10,
    Notification: 15
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2
  },
  FileType: {
    File: 1,
    Directory: 2
  },
  LanguageStatusSeverity,
  TreeItemCollapsibleState,

  // Commands
  commands: {
    executeCommand: jest.fn()
  },

  // Environment
  env: {
    machineId: '12345534'
  },

  // Extensions
  extensions: {
    getExtension: jest.fn()
  },

  // Languages
  languages: {
    createDiagnosticCollection: jest.fn(),
    createLanguageStatusItem: mockCreateLanguageStatusItem
  },

  // Theme
  ThemeColor: jest.fn(),

  // Window
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

  // Workspace with real file system operations
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
      stat: async uri => {
        try {
          const stats = await fs.promises.stat(uri.fsPath);
          return {
            type: stats.isDirectory() ? 2 : 1, // FileType.Directory = 2, FileType.File = 1
            ctime: stats.ctimeMs,
            mtime: stats.mtimeMs,
            size: stats.size
          };
        } catch (error) {
          throw error;
        }
      },
      readFile: async uri => {
        try {
          const content = await fs.promises.readFile(uri.fsPath);
          return new Uint8Array(content);
        } catch (error) {
          // Return empty buffer for non-existent files
          return new Uint8Array(0);
        }
      },
      readDirectory: async uri => {
        try {
          const entries = await fs.promises.readdir(uri.fsPath, { withFileTypes: true });
          return entries.map(entry => [
            entry.name,
            entry.isDirectory() ? 2 : 1 // FileType.Directory = 2, FileType.File = 1
          ]);
        } catch (error) {
          // Return empty array for non-existent directories
          return [];
        }
      },
      writeFile: async (uri, content) => {
        await fs.promises.writeFile(uri.fsPath, content);
      },
      createDirectory: async uri => {
        await fs.promises.mkdir(uri.fsPath, { recursive: true });
      },
      copy: async (source, destination) => {
        await fs.promises.copyFile(source.fsPath, destination.fsPath);
      },
      delete: async (uri, options) => {
        const stats = await fs.promises.stat(uri.fsPath);
        if (stats.isDirectory()) {
          await fs.promises.rm(uri.fsPath, { recursive: options?.recursive || false, force: true });
        } else {
          await fs.promises.unlink(uri.fsPath);
        }
      },
      rename: jest.fn()
    },
    registerTextDocumentContentProvider: jest.fn(),
    registerFileSystemProvider: jest.fn()
  },

  // Language Server Protocol classes
  CompletionItem: class {
    constructor(label) {}
  },
  CodeLens: class {
    constructor(range) {}
  },
  DocumentLink: class {
    constructor(range, target) {}
  },
  CodeAction: class {
    constructor(title, data) {}
  },
  Diagnostic: class {
    constructor(range, message, severity) {}
  },
  CallHierarchyItem: class {
    constructor(kind, name, detail, uri, range, selectionRange) {}
  },
  TypeHierarchyItem: class {
    constructor(kind, name, detail, uri, range, selectionRange) {}
  },
  SymbolInformation: class {
    constructor(name, kind, range, uri, containerName) {}
  },
  InlayHint: class {
    constructor(position, label, kind) {}
  },
  CancellationError: class {
    constructor() {}
  }
};

module.exports = vscode;
