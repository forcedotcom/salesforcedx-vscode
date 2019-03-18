import * as path from 'path';
import { commands, ExtensionContext, Uri, window, workspace } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

import { createQuickOpenCommand } from './commands/quickpick/quickpick';
import { ComponentTreeProvider } from './views/component-tree-provider';

import { ProgressLocation } from 'vscode';

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

export async function activate(context: ExtensionContext) {
    // UI customizations

    const serverModule = context.asAbsolutePath(path.join('node_modules', 'aura-language-server', 'lib', 'server.js'));

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
        outputChannelName: 'Aura Language Server',
        documentSelector: [
            {
                language: 'html',
                scheme: 'file'
            },
            {
                language: 'html',
                scheme: 'untitled'
            },
            { language: 'javascript', scheme: 'file' },
            { language: 'javascript', scheme: 'untitled' }
        ],
        synchronize: {
            fileEvents: [
                workspace.createFileSystemWatcher('**/*.resource'),
                workspace.createFileSystemWatcher('**/labels/CustomLabels.labels-meta.xml'),
                workspace.createFileSystemWatcher('**/aura/*/*.{cmp,app,intf,evt,js}'),
                workspace.createFileSystemWatcher('**/components/*/*/*.{cmp,app,intf,evt,lib,js}'),
                // need to watch for directory deletions as no events are created for contents or deleted directories
                workspace.createFileSystemWatcher('**/', true, true, false),

                // these need to be handled because we also maintain a lwc index for interop
                workspace.createFileSystemWatcher('**/staticresources/*.resource-meta.xml'),
                workspace.createFileSystemWatcher('**/contentassets/*.asset-meta.xml'),
                workspace.createFileSystemWatcher('**/lwc/*/*.js'),
                workspace.createFileSystemWatcher('**/modules/*/*/*.js')
            ]
        },
        uriConverters: {
            code2Protocol: code2ProtocolConverter,
            protocol2Code: protocol2CodeConverter
        }
    };

    // Create the language client and start the client.
    this.client = client = new LanguageClient('auraLanguageServer', 'Lightning Language Server', serverOptions, clientOptions);
    // UI customizations
    context.subscriptions.push(commands.registerCommand('salesforce-lightning-quickopen', createQuickOpenCommand(client)));
    const componentProvider = new ComponentTreeProvider(client, context);
    window.registerTreeDataProvider('salesforce-lightning-components', componentProvider);

    client.onReady().then(() => {
        this.client.onNotification('salesforce/indexingStarted', startIndexing);
        this.client.onNotification('salesforce/indexingEnded', endIndexing);
    });

    // do this last
    client.start();
    context.subscriptions.push(this.client);
}

let indexingResolve: any;

function startIndexing(): void {
    const indexingPromise: Promise<void> = new Promise(resolve => {
        indexingResolve = resolve;
    });
    reportIndexing(indexingPromise);
}

function endIndexing(): void {
    indexingResolve(undefined);
}

function reportIndexing(indexingPromise: Promise<void>) {
    window.withProgress(
        {
            location: ProgressLocation.Window,
            title: 'Indexing Lightning Components',
            cancellable: true
        },
        () => {
            return indexingPromise;
        }
    );
}
