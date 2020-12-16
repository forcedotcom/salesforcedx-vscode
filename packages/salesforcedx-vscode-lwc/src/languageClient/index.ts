import { Uri, workspace } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient';

// See https://github.com/Microsoft/vscode-languageserver-node/issues/105
export function code2ProtocolConverter(value: Uri) {
  if (/^win32/.test(process.platform)) {
    // The *first* : is also being encoded which is not the standard for URI on Windows
    // Here we transform it back to the standard way
    return value.toString().replace('%3A', ':');
  } else {
    return value.toString();
  }
}

function protocol2CodeConverter(value: string) {
  return Uri.parse(value);
}

export function createLanguageClient(serverPath: string): LanguageClient {
  // Setup the language server
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverPath, transport: TransportKind.ipc },
    debug: {
      module: serverPath,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { language: 'html', scheme: 'file' },
      { language: 'javascript', scheme: 'file' }
    ],
    synchronize: {
      fileEvents: [
        workspace.createFileSystemWatcher('**/*.resource'),
        workspace.createFileSystemWatcher(
          '**/labels/CustomLabels.labels-meta.xml'
        ),
        workspace.createFileSystemWatcher(
          '**/staticresources/*.resource-meta.xml'
        ),
        workspace.createFileSystemWatcher('**/contentassets/*.asset-meta.xml'),
        workspace.createFileSystemWatcher('**/lwc/*/*.js'),
        workspace.createFileSystemWatcher('**/modules/*/*/*.js'),
        // need to watch for directory deletions as no events are created for contents or deleted directories
        workspace.createFileSystemWatcher('**/', false, true, false)
      ]
    },
    uriConverters: {
      code2Protocol: code2ProtocolConverter,
      protocol2Code: protocol2CodeConverter
    }
  };

  // Create the language client and start the client.
  return new LanguageClient(
    'lwcLanguageServer',
    'LWC Language Server',
    serverOptions,
    clientOptions
  );
}
