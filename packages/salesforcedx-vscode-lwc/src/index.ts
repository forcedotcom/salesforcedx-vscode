/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as lspCommon from '@salesforce/salesforcedx-lightning-lsp-common';
import { FileSystemDataProvider } from '@salesforce/salesforcedx-lightning-lsp-common';
import { bootstrapWorkspaceAwareness, ActivationTracker } from '@salesforce/salesforcedx-utils-vscode';
import { Effect } from 'effect';
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

  // For workspace type detection, we still need to check the file system
  // Create a temporary provider just for detection
  const tempFileSystemProvider = await createFileSystemProvider(workspaceUris);
  const workspaceType = await lspCommon.detectWorkspaceType(workspaceUris, tempFileSystemProvider);

  // Check if we have a valid project structure
  if (getActivationMode() === 'autodetect' && !lspCommon.isLWC(workspaceType)) {
    // If activationMode === autodetect and we don't have a valid workspace type, exit
    log('LWC LSP - autodetect did not find a valid project structure, exiting....');
    log(`WorkspaceType detected: ${workspaceType}`);
    return;
  }

  // register commands
  const ourCommands = registerCommands(extensionContext);
  extensionContext.subscriptions.push(ourCommands);

  // Start the LWC Language Server
  const serverPath = extensionContext.extension.packageJSON.serverPath;
  const serverModule = extensionContext.asAbsolutePath(path.join(...serverPath));
  const client = createLanguageClient(serverModule);

  // Start the client and add it to subscriptions
  await client.start();
  extensionContext.subscriptions.push(client);

  // Trigger loading of workspace files into document cache after server initialization
  // This runs asynchronously and does not block extension activation
  void Effect.runPromise(
    bootstrapWorkspaceAwareness({
      fileGlob: '**/lwc/**/*.{js,ts,html}',
      excludeGlob: '**/{node_modules,.sfdx,.git,dist,out,lib,coverage}/**',
      logger: log
    })
  ).catch((error: unknown) => {
    log(`Failed to bootstrap workspace awareness: ${String(error)}`);
  });

  // Also load essential JSON files for workspace type detection
  void Effect.runPromise(
    bootstrapWorkspaceAwareness({
      fileGlob: '*.{json,xml}',
      excludeGlob: '**/{node_modules,.sfdx,.git,dist,out,lib,coverage}/**',
      logger: log
    })
  ).catch((error: unknown) => {
    log(`Failed to bootstrap essential files: ${String(error)}`);
  });

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
 * Creates a minimal FileSystemDataProvider with only files needed for workspace type detection
 * @param workspaceUris Array of workspace folder paths
 * @returns FileSystemDataProvider with only workspace type detection files
 */
const createFileSystemProvider = async (workspaceUris: string[]): Promise<FileSystemDataProvider> => {
  const fileSystemProvider = new FileSystemDataProvider();

  for (const workspaceUri of workspaceUris) {
    try {
      await populateWorkspaceTypeFiles(fileSystemProvider, workspaceUri);
    } catch (error) {
      log(`Error populating workspace type files for workspace ${workspaceUri}: ${String(error)}`);
      throw error;
    }
  }

  return fileSystemProvider;
};

/**
 * Populates only the files needed for workspace type detection
 * @param provider FileSystemDataProvider to populate
 * @param workspaceRoot Path to the workspace root
 */
const populateWorkspaceTypeFiles = async (provider: FileSystemDataProvider, workspaceRoot: string): Promise<void> => {
  // Files that detectWorkspaceType checks for, in order of priority
  const workspaceTypeFiles = [
    'sfdx-project.json',
    'workspace-user.xml',
    'lwc.config.json',
    'package.json',
    'lerna.json'
  ];

  // Also check parent directory for workspace-user.xml (for CORE_PARTIAL detection)
  const parentWorkspaceUserPath = path.join(workspaceRoot, '..', 'workspace-user.xml');

  // Try to read each workspace type detection file
  for (const fileName of workspaceTypeFiles) {
    const filePath = path.join(workspaceRoot, fileName);
    await tryReadFile(provider, filePath);
  }

  // Also try parent workspace-user.xml
  await tryReadFile(provider, parentWorkspaceUserPath);
};

/**
 * Attempts to read a file and add it to the provider if it exists
 * @param provider FileSystemDataProvider to update
 * @param filePath Path to the file to read
 */
const tryReadFile = async (provider: FileSystemDataProvider, filePath: string): Promise<void> => {
  try {
    const fileUri = Uri.parse(filePath);
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
  } catch (error: any) {
    // File doesn't exist or can't be read - this is expected for most files
    // Only log if it's an unexpected error
    if (!(error instanceof Error) || !error.message.includes('ENOENT')) {
      log(`Unexpected error reading file ${filePath}: ${String(error)}`);
    }
  }
};
