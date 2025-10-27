/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as lspCommon from '@salesforce/salesforcedx-lightning-lsp-common';
import { FileSystemDataProvider } from '@salesforce/salesforcedx-lightning-lsp-common';
import { ActivationTracker } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import { commands, Disposable, ExtensionContext, workspace, Uri } from 'vscode';
import { lightningLwcOpen, lightningLwcPreview, lightningLwcStart, lightningLwcStop } from './commands';
import { log } from './constants';
import { createLanguageClient } from './languageClient';
import { metaSupport } from './metasupport';
import { DevServerService } from './service/devServerService';
import { telemetryService } from './telemetry';
import { activateLwcTestSupport, shouldActivateLwcTestSupport } from './testSupport';
import { WorkspaceUtils } from './util/workspaceUtils';

export const activate = async (extensionContext: ExtensionContext) => {
  const activateTracker = new ActivationTracker(extensionContext, telemetryService);

  log(`Activation Mode: ${getActivationMode()}`);
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

  const fileSystemProvider = await createSmartFileSystemProvider(workspaceUris);

  // If activationMode is autodetect or always, check workspaceType before startup
  const workspaceType = await lspCommon.detectWorkspaceType(workspaceUris, fileSystemProvider);

  // Check if we have a valid project structure
  if (getActivationMode() === 'autodetect' && !lspCommon.isLWC(workspaceType)) {
    // If activationMode === autodetect and we don't have a valid workspace type, exit
    log('LWC LSP - autodetect did not find a valid project structure, exiting....');
    log(`WorkspaceType detected: ${workspaceType}`);
    return;
  }
  // If activationMode === always, ignore workspace type and continue activating

  // register commands
  const ourCommands = registerCommands(extensionContext);
  extensionContext.subscriptions.push(ourCommands);

  // If we get here, we either passed autodetect validation or activationMode == always
  log('Lightning Web Components Extension Activated');
  log(`WorkspaceType detected: ${workspaceType}`);

  // Create a FileSystemDataProvider with workspace files for the language server
  const serverFileSystemProvider = await createSmartFileSystemProvider(workspaceUris);

  // Start the LWC Language Server
  const serverPath = extensionContext.extension.packageJSON.serverPath;
  const serverModule = extensionContext.asAbsolutePath(path.join(...serverPath));
  const client = createLanguageClient(serverModule, serverFileSystemProvider);

  // Start the client and add it to subscriptions
  await client.start();
  extensionContext.subscriptions.push(client);

  // The language server will use its FileSystemDataProvider to read files when needed
  // No need to populate the server's fileSystemProvider via custom LSP methods

  // Creates resources for js-meta.xml to work
  await metaSupport.getMetaSupport();

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
  return config.get('activationMode') ?? 'autodetect'; // default to autodetect
};

const registerCommands = (_extensionContext: ExtensionContext): Disposable =>
  Disposable.from(
    commands.registerCommand('sf.lightning.lwc.start', lightningLwcStart),
    commands.registerCommand('sf.lightning.lwc.stop', lightningLwcStop),
    commands.registerCommand('sf.lightning.lwc.open', lightningLwcOpen),
    commands.registerCommand('sf.lightning.lwc.preview', lightningLwcPreview)
  );

/**
 * Creates a smart FileSystemDataProvider that only reads files needed for workspace detection
 * @param workspaceUris Array of workspace folder paths
 * @returns FileSystemDataProvider with only essential files
 */
const createSmartFileSystemProvider = async (workspaceUris: string[]): Promise<FileSystemDataProvider> => {
  const fileSystemProvider = new FileSystemDataProvider();

  for (const workspaceUri of workspaceUris) {
    try {
      await populateEssentialFiles(fileSystemProvider, workspaceUri);
    } catch (error) {
      log(`Error populating essential files for workspace ${workspaceUri}: ${error}`);
    }
  }

  return fileSystemProvider;
};

/**
 * Populates only the essential files needed for workspace detection
 * @param provider FileSystemDataProvider to populate
 * @param workspacePath Path to the workspace directory
 */
const populateEssentialFiles = async (provider: FileSystemDataProvider, workspacePath: string): Promise<void> => {
  const essentialFiles = ['sfdx-project.json', 'workspace-user.xml', 'lwc.config.json', 'package.json', 'lerna.json'];

  // Check files in current directory
  for (const fileName of essentialFiles) {
    const filePath = path.join(workspacePath, fileName);
    await tryReadFile(provider, filePath);
  }

  // Check parent directory for workspace-user.xml (CORE_PARTIAL detection)
  const parentWorkspaceUserPath = path.join(workspacePath, '..', 'workspace-user.xml');
  await tryReadFile(provider, parentWorkspaceUserPath);
};

/**
 * Attempts to read a file and add it to the provider if it exists
 * @param provider FileSystemDataProvider to update
 * @param filePath Path to the file to read
 */
const tryReadFile = async (provider: FileSystemDataProvider, filePath: string): Promise<void> => {
  try {
    const fileUri = Uri.file(filePath);
    const fileContent = await workspace.fs.readFile(fileUri);
    const content = Buffer.from(fileContent).toString('utf8');

    provider.updateFileContent(filePath, content);
    provider.updateFileStat(filePath, {
      type: 'file',
      exists: true,
      ctime: Date.now(),
      mtime: Date.now(),
      size: content.length
    });
  } catch (error) {
    // File doesn't exist or can't be read - this is expected for most files
    // Only log if it's an unexpected error
    if (!error.message?.includes('ENOENT')) {
      log(`Unexpected error reading file ${filePath}: ${error}`);
    }
  }
};
