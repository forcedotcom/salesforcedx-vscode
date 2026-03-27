/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isLWC, LWC_SERVER_READY_NOTIFICATION, type WorkspaceType } from '@salesforce/salesforcedx-lightning-lsp-common';
import { registerWorkspaceReadFileHandler } from '@salesforce/salesforcedx-lightning-lsp-common/workspaceReadFileHandler';
import { ActivationTracker, detectWorkspaceType } from '@salesforce/salesforcedx-utils-vscode';
import type { TelemetryServiceInterface } from '@salesforce/vscode-service-provider';
import { ExtensionContext, workspace } from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { channelService } from './channel';
import { log } from './constants';
import { createLanguageClient } from './languageClient';
import LwcLspStatusBarItem from './lwcLspStatusBarItem';
import { metaSupport } from './metasupport';
import { startLwcFileWatcherViaServices } from './util/lwcFileWatcher';

const getTelemetryService = async (): Promise<TelemetryServiceInterface> => {
  const telemetryModule = await import('./telemetry/index.js');
  return telemetryModule.telemetryService;
};

export const activate = async (extensionContext: ExtensionContext) => {
  try {
    channelService.appendLine('Lightning Web Components extension activating...');
  } catch (e) {
    console.error('[LWC] Failed to append to channel:', e);
  }

  let activateTracker: ActivationTracker | undefined;
  let telemetryService: TelemetryServiceInterface | undefined;
  if (process.env.ESBUILD_PLATFORM !== 'web') {
    telemetryService = await getTelemetryService();
    activateTracker = new ActivationTracker(extensionContext, telemetryService);
  }

  // Run our auto detection routine before we activate
  // If activationMode is off, don't startup no matter what
  if (getActivationMode() === 'off') {
    channelService.appendLine('LWC Language Server activationMode set to off, exiting...');
    return;
  }

  // Initialize telemetry service (now works in both Node.js and web mode)
  if (telemetryService) {
    try {
      await telemetryService.initializeService(extensionContext);
    } catch (e) {
      const errorMsg = `Failed to initialize telemetry service: ${String(e)}`;
      channelService.appendLine(errorMsg);
    }
  }

  // if we have no workspace folders, exit
  if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
    channelService.appendLine('No workspace folders found, exiting extension');
    return;
  }

  // Pass the workspace folder URIs to the language server
  const workspaceFolderPaths: string[] = [];
  workspace.workspaceFolders.forEach(folder => {
    // In web mode, fsPath might be undefined for non-file:// URIs
    // Use fsPath if available, otherwise fall back to URI path
    const folderPath = folder.uri.fsPath ?? folder.uri.path;
    if (folderPath) {
      workspaceFolderPaths.push(folderPath);
    }
  });

  // For workspace type detection, we still need to check the file system
  // Create a temporary provider just for detection
  // In web mode with no valid paths, default to UNKNOWN
  const workspaceType: WorkspaceType =
    workspaceFolderPaths.length > 0 ? await detectWorkspaceType(workspaceFolderPaths) : 'UNKNOWN';

  // Check if we have a valid project structure
  if (getActivationMode() === 'autodetect' && !isLWC(workspaceType)) {
    // If activationMode === autodetect and we don't have a valid workspace type, exit
    channelService.appendLine(
      `LWC LSP - autodetect did not find a valid project structure, exiting. WorkspaceType detected: ${workspaceType}`
    );
    return;
  }

  // Start the LWC Language Server
  const serverPath = extensionContext.extension.packageJSON.serverPath;
  let serverModule: string;
  if (process.env.ESBUILD_PLATFORM === 'web') {
    // For web mode, use the browser bundle and convert to URI
    const baseUri = URI.from(extensionContext.extensionUri);
    serverModule = Utils.joinPath(baseUri, 'dist', 'web', 'lwcServer.js').toString();
  } else {
    // For Node.js mode, use the file system path
    // Dynamically import path only in Node.js mode to avoid bundling issues in web mode
    const { join } = await import('node:path');
    serverModule = extensionContext.asAbsolutePath(join(...serverPath));
  }

  try {
    const sfdxTypingsDir = Utils.joinPath(
      URI.from(extensionContext.extensionUri),
      'resources',
      'sfdx',
      'typings'
    ).toString();
    const client = await createLanguageClient(serverModule, { workspaceType, sfdxTypingsDir });

    // Create language status item to show indexing progress
    const statusBarItem = new LwcLspStatusBarItem();
    extensionContext.subscriptions.push(statusBarItem);

    // Listen for server ready notification to update status
    client.onNotification(LWC_SERVER_READY_NOTIFICATION, () => {
      statusBarItem.ready();
    });

    // Start the client and add it to subscriptions
    channelService.appendLine('Starting LWC Language Server...');
    // Register workspace read file handler before start so the server can read files (e.g. sfdx-project.json) during initialize
    registerWorkspaceReadFileHandler(client, channelService);

    try {
      await client.start();
    } catch (startError) {
      const errorMsg = `[LWC] Failed to start client: ${startError instanceof Error ? startError.message : String(startError)}`;
      channelService.appendLine(errorMsg);
      throw startError;
    }

    extensionContext.subscriptions.push(client);
    channelService.appendLine('LWC Language Server started successfully');
    channelService.appendLine('Check "LWC Language Server" output channel for server logs');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    channelService.appendLine(`Failed to start LWC Language Server: ${errorMessage}`);
    throw error; // Re-throw to prevent silent failures
  }

  // Creates resources for js-meta.xml to work
  await metaSupport.getMetaSupport();

  // Watch for newly created LWC files and auto-open them to trigger delayed initialization
  // This handles the case where files are downloaded from org browser after server starts
  // Opening files syncs them to the server via onDidOpen, which triggers delayed initialization
  startLwcFileWatcherViaServices();

  // Activate Test support (skip in web mode - test execution requires Node.js/terminal)
  if (process.env.ESBUILD_PLATFORM !== 'web') {
    try {
      // Lazy load test support to avoid bundling jest-editor-support in web mode
      const testSupport = await import('./testSupport/index.js');

      if (testSupport.shouldActivateLwcTestSupport(workspaceType)) {
        testSupport.activateLwcTestSupport(extensionContext, workspaceType);
      }
    } catch (e) {
      channelService.appendLine(`Failed to load test support: ${String(e)}`);
    }
  }

  // Notify telemetry that our extension is now active
  if (activateTracker) {
    void activateTracker.markActivationStop();
  }

  channelService.appendLine('Lightning Web Components extension activation complete.');
};

export const deactivate = async () => {
  log('Lightning Web Components Extension Deactivated');
  if (process.env.ESBUILD_PLATFORM !== 'web') {
    const telemetryService = await getTelemetryService();
    telemetryService.sendExtensionDeactivationEvent();
  }
};

const getActivationMode = (): string => {
  const config = workspace.getConfiguration('salesforcedx-vscode-lightning');
  return config.get('activationMode') ?? 'autodetect'; // default to autodetect
};
