/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { shared as lspCommon } from '@salesforce/lightning-lsp-common';
import { ActivationTracker, SFDX_LWC_EXTENSION_NAME } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'path';
import { commands, ConfigurationTarget, Disposable, ExtensionContext, workspace, WorkspaceConfiguration } from 'vscode';
import { lightningLwcOpen, lightningLwcPreview, lightningLwcStart, lightningLwcStop } from './commands';
import { ESLINT_NODEPATH_CONFIG, log } from './constants';
import { createLanguageClient } from './languageClient';
import { metaSupport } from './metasupport';
import { DevServerService } from './service/devServerService';
import { telemetryService } from './telemetry';
import { activateLwcTestSupport, shouldActivateLwcTestSupport } from './testSupport';
import { WorkspaceUtils } from './util/workspaceUtils';

export const activate = async (extensionContext: ExtensionContext) => {
  const activateTracker = new ActivationTracker(extensionContext, telemetryService);

  log('Activation Mode: ' + getActivationMode());
  // Run our auto detection routine before we activate
  // If activationMode is off, don't startup no matter what
  if (getActivationMode() === 'off') {
    log('LWC Language Server activationMode set to off, exiting...');
    return;
  }

  // Initialize telemetry service
  await telemetryService.initializeService(extensionContext);

  // if we have no workspace folders, exit
  if (!workspace.workspaceFolders) {
    log('No workspace, exiting extension');
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
    log('LWC LSP - autodetect did not find a valid project structure, exiting....');
    log('WorkspaceType detected: ' + workspaceType);
    return;
  }
  // If activationMode === always, ignore workspace type and continue activating

  // register commands
  const ourCommands = registerCommands(extensionContext);
  extensionContext.subscriptions.push(ourCommands);

  // If we get here, we either passed autodetect validation or activationMode == always
  log('Lightning Web Components Extension Activated');
  log('WorkspaceType detected: ' + workspaceType);

  // Start the LWC Language Server
  const serverPath = extensionContext.extension.packageJSON.serverPath;
  const serverModule = extensionContext.asAbsolutePath(path.join(...serverPath));
  const client = createLanguageClient(serverModule);

  extensionContext.subscriptions.push(client.start());

  // Creates resources for js-meta.xml to work
  await metaSupport.getMetaSupport();

  if (workspaceType === lspCommon.WorkspaceType.SFDX) {
    // We no longer want to manage the eslint.nodePath. Remove any previous configuration of the nodepath
    // which points at our LWC extension node_modules path
    const config: WorkspaceConfiguration = workspace.getConfiguration('');
    const currentNodePath = config.get<string>(ESLINT_NODEPATH_CONFIG);
    if (currentNodePath && currentNodePath.includes(SFDX_LWC_EXTENSION_NAME)) {
      try {
        log('Removing eslint.nodePath setting as the LWC Extension no longer manages this value');
        await config.update(ESLINT_NODEPATH_CONFIG, undefined, ConfigurationTarget.Workspace);
      } catch (e) {
        telemetryService.sendException('lwc_eslint_nodepath_couldnt_be_set', e.message);
      }
    }
  }

  // Activate Test support
  if (shouldActivateLwcTestSupport(workspaceType)) {
    activateLwcTestSupport(extensionContext, workspaceType);
  }

  // Initialize utils for user settings
  WorkspaceUtils.instance.init(extensionContext);

  // Notify telemetry that our extension is now active
  void activateTracker.markActivationStop();
};

export const deactivate = async () => {
  if (DevServerService.instance.isServerHandlerRegistered()) {
    await DevServerService.instance.stopServer();
  }
  log('Lightning Web Components Extension Deactivated');
  telemetryService.sendExtensionDeactivationEvent();
};

const getActivationMode = (): string => {
  const config = workspace.getConfiguration('salesforcedx-vscode-lightning');
  return config.get('activationMode') || 'autodetect'; // default to autodetect
};

const registerCommands = (_extensionContext: ExtensionContext): Disposable => {
  return Disposable.from(
    commands.registerCommand('sf.lightning.lwc.start', lightningLwcStart),
    commands.registerCommand('sf.lightning.lwc.stop', lightningLwcStop),
    commands.registerCommand('sf.lightning.lwc.open', lightningLwcOpen),
    commands.registerCommand('sf.lightning.lwc.preview', lightningLwcPreview)
  );
};
