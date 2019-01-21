import * as path from 'path';
import { commands, ExtensionContext, Uri, workspace } from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient';

import { logger } from './utils';

let client: LanguageClient;

// See https://github.com/Microsoft/vscode-languageserver-node/issues/105
export function code2ProtocolConverter(value: Uri): string {
  if (/^win32/.test(process.platform)) {
    // The *first* : is also being encoded which is not the standard for URI on Windows
    // Here we transform it back to the standard way
    return value.toString().replace('%3A', ':');
  } else {
    return value.toString();
  }
}

function protocol2CodeConverter(value: string): Uri {
  return Uri.parse(value);
}

async function timeout(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function activate(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join('node_modules', 'aura-language-server', 'lib', 'server.js')
  );

  // The debug options for the server
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6020'] };
  // let debugOptions = { };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  const clientOptions: LanguageClientOptions = {
    outputChannelName: 'Aura LSP Debug',
    documentSelector: ['html', 'javascript'],
    synchronize: {
      fileEvents: [
        workspace.createFileSystemWatcher('**/*.resource'),
        workspace.createFileSystemWatcher(
          '**/labels/CustomLabels.labels-meta.xml'
        ),
        workspace.createFileSystemWatcher('**/lightningcomponents/**/*.js'),
        // need to watch for directory deletions as no events are created for contents or deleted directories
        workspace.createFileSystemWatcher('**/', true, true, false)
      ]
    },
    uriConverters: {
      code2Protocol: code2ProtocolConverter,
      protocol2Code: protocol2CodeConverter
    }
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    'auraLanguageServer',
    'Lightning Language Server',
    serverOptions,
    clientOptions
  );
  client.start();
}

export function deactivate(): Thenable<void> {
  if (!client) {
    return Promise.resolve(undefined);
  }
  return client.stop();
}
