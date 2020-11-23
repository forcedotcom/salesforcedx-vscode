/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { shared as lspCommon } from '@salesforce/lightning-lsp-common';
import * as path from 'path';
import {
  commands,
  ConfigurationTarget,
  Disposable,
  ExtensionContext,
  Uri,
  workspace,
  WorkspaceConfiguration
} from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient';
import {
  forceLightningLwcOpen,
  forceLightningLwcPreview,
  forceLightningLwcStart,
  forceLightningLwcStop
} from './commands';
import { ESLINT_NODEPATH_CONFIG, LWC_EXTENSION_NAME } from './constants';
import { metaSupport } from './metasupport';
import { DevServerService } from './service/devServerService';
import { telemetryService } from './telemetry';
import {
  activateLwcTestSupport,
  shouldActivateLwcTestSupport
} from './testSupport';
import { WorkspaceUtils } from './util/workspaceUtils';

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

export async function activate(context: ExtensionContext) {
  const extensionHRStart = process.hrtime();
  console.log('Activation Mode: ' + getActivationMode());
  // Run our auto detection routine before we activate
  // If activationMode is off, don't startup no matter what
  if (getActivationMode() === 'off') {
    console.log('LWC Language Server activationMode set to off, exiting...');
    return;
  }

  // Initialize telemetry service
  const extensionPackage = require(context.asAbsolutePath('./package.json'));
  await telemetryService.initializeService(
    context,
    LWC_EXTENSION_NAME,
    extensionPackage.aiKey,
    extensionPackage.version
  );

  // if we have no workspace folders, exit
  if (!workspace.workspaceFolders) {
    console.log('No workspace, exiting extension');
    return;
  }

  // Pass the workspace folder URIs to the language server
  const workspaceUris: string[] = [];
  workspace.workspaceFolders.forEach(folder => {
    workspaceUris.push(folder.uri.fsPath);
  });

  // If activationMode is autodetect or always, check workspaceType before startup
  const workspaceType = lspCommon.detectWorkspaceType(workspaceUris);

  // Check if we have a valid project structure
  if (getActivationMode() === 'autodetect' && !lspCommon.isLWC(workspaceType)) {
    // If activationMode === autodetect and we don't have a valid workspace type, exit
    console.log(
      'LWC LSP - autodetect did not find a valid project structure, exiting....'
    );
    console.log('WorkspaceType detected: ' + workspaceType);
    return;
  }
  // If activationMode === always, ignore workspace type and continue activating

  // register commands
  const ourCommands = registerCommands(context);
  context.subscriptions.push(ourCommands);

  // If we get here, we either passed autodetect validation or activationMode == always
  console.log('Lightning Web Components Extension Activated');
  console.log('WorkspaceType detected: ' + workspaceType);

  // Start the LWC Language Server
  startLWCLanguageServer(context);

  // Creates resources for js-meta.xml to work
  await metaSupport.getMetaSupport();

  if (workspaceType === lspCommon.WorkspaceType.SFDX) {
    // We no longer want to manage the eslint.nodePath. Remove any previous configuration of the nodepath
    // which points at our LWC extension node_modules path
    const config: WorkspaceConfiguration = workspace.getConfiguration('');
    const currentNodePath = config.get<string>(ESLINT_NODEPATH_CONFIG);
    if (currentNodePath && currentNodePath.includes(LWC_EXTENSION_NAME)) {
      try {
        console.log(
          'Removing eslint.nodePath setting as the LWC Extension no longer manages this value'
        );
        await config.update(
          ESLINT_NODEPATH_CONFIG,
          undefined,
          ConfigurationTarget.Workspace
        );
      } catch (e) {
        await telemetryService.sendException(
          'lwc_eslint_nodepath_couldnt_be_set',
          e.message
        );
      }
    }
  }

  // Activate Test support
  if (shouldActivateLwcTestSupport(workspaceType)) {
    activateLwcTestSupport(context, workspaceType);
  }

  // Initialize utils for user settings
  WorkspaceUtils.instance.init(context);

  // Notify telemetry that our extension is now active
  telemetryService.sendExtensionActivationEvent(extensionHRStart).catch();
}

export async function deactivate() {
  if (DevServerService.instance.isServerHandlerRegistered()) {
    await DevServerService.instance.stopServer();
  }
  console.log('Lightning Web Components Extension Deactivated');
  telemetryService.sendExtensionDeactivationEvent().catch();
}

function getActivationMode(): string {
  const config = workspace.getConfiguration('salesforcedx-vscode-lightning');
  return config.get('activationMode') || 'autodetect'; // default to autodetect
}

function registerCommands(_extensionContext: ExtensionContext): Disposable {
  return Disposable.from(
    commands.registerCommand(
      'sfdx.force.lightning.lwc.start',
      forceLightningLwcStart
    ),
    commands.registerCommand(
      'sfdx.force.lightning.lwc.stop',
      forceLightningLwcStop
    ),
    commands.registerCommand(
      'sfdx.force.lightning.lwc.open',
      forceLightningLwcOpen
    ),
    commands.registerCommand(
      'sfdx.force.lightning.lwc.preview',
      forceLightningLwcPreview
    )
  );
}

function startLWCLanguageServer(context: ExtensionContext) {
  // Setup the language server
  const serverModule = context.asAbsolutePath(
    path.join(
      'node_modules',
      '@salesforce',
      'lwc-language-server',
      'lib',
      'server.js'
    )
  );
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
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
  const client = new LanguageClient(
    'lwcLanguageServer',
    'LWC Language Server',
    serverOptions,
    clientOptions
  ).start();

  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  context.subscriptions.push(client);
}
