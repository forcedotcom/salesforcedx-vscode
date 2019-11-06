/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import { shared as lspCommon } from 'lightning-lsp-common';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  commands,
  ConfigurationChangeEvent,
  ConfigurationTarget,
  ExtensionContext,
  Uri,
  window,
  workspace,
  WorkspaceConfiguration
} from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient';
import { sync as which } from 'which';
import {
  forceLightningLwcOpen,
  forceLightningLwcPreview,
  forceLightningLwcStart,
  forceLightningLwcStop
} from './commands';
import {
  ESLINT_NODEPATH_CONFIG,
  LWC_EXTENSION_NAME,
  MANAGE_ESLINT_NODEPATH
} from './constants';
import { DevServerService } from './service/devServerService';
import { telemetryService } from './telemetry';
import { activateLwcTestSupport } from './testSupport';

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

export async function activate(this: any, context: ExtensionContext) {
  const extensionHRStart = process.hrtime();
  console.log('Activation Mode: ' + getActivationMode());
  // Run our auto detection routine before we activate
  // If activationMode is off, don't startup no matter what
  if (getActivationMode() === 'off') {
    console.log('LWC Language Server activationMode set to off, exiting...');
    return;
  }

  // if we have no workspace folders, exit
  if (!workspace.workspaceFolders) {
    console.log('No workspace, exiting extension');
    return;
  }

  // If activationMode is autodetect or always, check workspaceType before startup
  const workspaceType = lspCommon.detectWorkspaceType(
    workspace.workspaceFolders[0].uri.fsPath
  );

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
  const commands = registerCommands(context);
  context.subscriptions.push(commands);

  // If we get here, we either passed autodetect validation or activationMode == always
  console.log('Lightning Web Components Extension Activated');
  console.log('WorkspaceType detected: ' + workspaceType);

  // Start the LWC Language Server
  startLWCLanguageServer(context);

  if (workspaceType === lspCommon.WorkspaceType.SFDX) {
    // Additional eslint configuration
    const extNodePath = context.asAbsolutePath(path.join('node_modules'));
    workspace.onDidChangeConfiguration(settingsChanged.bind(this, extNodePath));
    await populateEslintSettingIfNecessary();

    // Activate Test support only for SFDX workspace type for now
    activateLwcTestSupport(context);
  }

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

function registerCommands(
  extensionContext: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.Disposable.from(
    vscode.commands.registerCommand(
      'sfdx.force.lightning.lwc.start',
      forceLightningLwcStart
    ),
    vscode.commands.registerCommand(
      'sfdx.force.lightning.lwc.stop',
      forceLightningLwcStop
    ),
    vscode.commands.registerCommand(
      'sfdx.force.lightning.lwc.open',
      forceLightningLwcOpen
    ),
    vscode.commands.registerCommand(
      'sfdx.force.lightning.lwc.preview',
      forceLightningLwcPreview
    )
  );
}

function startLWCLanguageServer(context: ExtensionContext) {
  // Setup the language server
  const serverModule = context.asAbsolutePath(
    path.join('node_modules', 'lwc-language-server', 'lib', 'server.js')
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

// Check package.json for eslint dependencies
export function containsEslintConfiguration(packageJson: string) {
  try {
    if (fs.existsSync(packageJson)) {
      // Check if package.json contains @lwc/engine
      const packageInfo = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
      const devDependencies = Object.keys(packageInfo.devDependencies || {});
      if (
        devDependencies.includes('eslint') &&
        devDependencies.includes('@salesforce/eslint-config-lwc')
      ) {
        return true;
      }
    }
  } catch (e) {}
  return false;
}

async function settingsChanged(
  pluginNodePath: string,
  e: ConfigurationChangeEvent
) {
  if (e.affectsConfiguration(MANAGE_ESLINT_NODEPATH)) {
    const config: WorkspaceConfiguration = workspace.getConfiguration('');
    const manageNodepath = config.get<string>(MANAGE_ESLINT_NODEPATH);

    // User wants us to manage their eslint nodepath
    if (manageNodepath === 'Yes') {
      const currentNodePath = config.get<string>(ESLINT_NODEPATH_CONFIG);

      // User has not set one, use the eslint bundled with our extension
      // or if it is from salesforcedx-vscode-lwc, update since the path looks like
      // "eslint.nodePath": ".../.vscode/extensions/salesforce.salesforcedx-vscode-lwc-41.17.0/node_modules",
      // which contains the version number and needs to be updated on each extension
      if (!currentNodePath || currentNodePath.includes(LWC_EXTENSION_NAME)) {
        await config.update(
          ESLINT_NODEPATH_CONFIG,
          pluginNodePath,
          ConfigurationTarget.Workspace
        );
      }
    }
  }
}

export async function populateEslintSettingIfNecessary() {
  const config: WorkspaceConfiguration = workspace.getConfiguration('');

  // Check package json for devDeps of eslint-plugin-lwc
  const packageJson = path.join(workspace.rootPath || '', 'package.json');
  const hasProperDeps = containsEslintConfiguration(packageJson);

  // If we have the proper dependencies, just return and don't do anything
  if (hasProperDeps) {
    return;
  }

  // If we get here its because eslint isn't setup properly

  // Check our user settings to see if we should prompt them
  let shouldManageEslintNodepath = config.get<string>(MANAGE_ESLINT_NODEPATH);

  // If setting is not set (defaults to '')
  if (!shouldManageEslintNodepath) {
    if (workspace) {
      shouldManageEslintNodepath = await window.showInformationMessage(
        'It appears you do not have ESLint configured for LWC in your current project. Would you like us to automatically configure your eslint.nodePath so that ESLint will work correctly? [Learn More](https://github.com/salesforce/eslint-config-lwc/blob/master/README.md)',
        'Yes',
        'No'
      );
    }

    // User can click cancel, so only set the preference if they actually clicked Yes or No
    if (shouldManageEslintNodepath) {
      await config.update(
        MANAGE_ESLINT_NODEPATH,
        shouldManageEslintNodepath,
        ConfigurationTarget.Workspace
      );
    }

    // Provide a button that jumps directly to our specific LWC settings
    let clickedSettings;

    // If Yes, Let the user know they can change this preference at any time
    if (shouldManageEslintNodepath === 'Yes') {
      clickedSettings = await window.showInformationMessage(
        'eslint.nodePath will now be managed by the LWC extension for this project. If you change your mind, you can update your preferences below',
        'Configure LWC Settings'
      );
    }

    // If user does not choose yes, warn them that eslint may not function
    if (shouldManageEslintNodepath !== 'Yes') {
      clickedSettings = await window.showWarningMessage(
        'ESLint will not work correctly for LWC until you have set it up. Follow the guide here: [Setting up ESLint for LWC](https://github.com/salesforce/eslint-config-lwc/blob/master/README.md) or update your vscode settings to allow automatic configuration of ESLint.',
        'Configure LWC Settings'
      );
    }

    if (clickedSettings) {
      await commands.executeCommand(
        'workbench.action.openWorkspaceSettings',
        '@ext:salesforce.salesforcedx-vscode-lwc'
      );
    }
  }
}
