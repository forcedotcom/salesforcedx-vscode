/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as lspCommon from '@salesforce/salesforcedx-lightning-lsp-common';
import {
  ActivationTracker,
  bootstrapWorkspaceAwareness,
  detectWorkspaceType
} from '@salesforce/salesforcedx-utils-vscode';
import type { TelemetryServiceInterface } from '@salesforce/vscode-service-provider';
import { Effect } from 'effect';
import { commands, Disposable, ExtensionContext, Uri, workspace } from 'vscode';
import { channelService } from './channel';
import { lightningLwcOpen, lightningLwcPreview, lightningLwcStart, lightningLwcStop } from './commands';
import { log } from './constants';
import { createLanguageClient } from './languageClient';
import { metaSupport } from './metasupport';
import { DevServerService } from './service/devServerService';
// Test support is lazy-loaded to avoid bundling jest-editor-support in web mode
import { WorkspaceUtils } from './util/workspaceUtils';

// Get telemetry service - now works in both Node.js and web mode
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

  // Register commands (only once)
  const ourCommands = registerCommands(extensionContext);
  extensionContext.subscriptions.push(ourCommands);

  // Get telemetry service (lazy load - no-op in web mode)
  const telemetryService = await getTelemetryService();
  const activateTracker = new ActivationTracker(extensionContext, telemetryService);

  // Run our auto detection routine before we activate
  // If activationMode is off, don't startup no matter what
  if (getActivationMode() === 'off') {
    channelService.appendLine('LWC Language Server activationMode set to off, exiting...');
    return;
  }

  // Initialize telemetry service (now works in both Node.js and web mode)
  try {
    await telemetryService.initializeService(extensionContext);
  } catch (e) {
    const errorMsg = `Failed to initialize telemetry service: ${String(e)}`;
    channelService.appendLine(errorMsg);
  }

  // In web mode, workspace folders might not be available immediately
  // Wait a bit for them to load if they're not available yet
  if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
    // Wait for workspace folders with a timeout
    const maxWaitTime = 2000; // 2 seconds
    const checkInterval = 100; // Check every 100ms
    let waited = 0;
    while ((!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) && waited < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }
  }

  // if we have no workspace folders, exit
  if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
    const msg = 'No workspace folders found, exiting extension';
    log(msg);
    channelService.appendLine(msg);
    return;
  }

  // Pass the workspace folder URIs to the language server
  const workspaceUris: string[] = [];
  workspace.workspaceFolders.forEach(folder => {
    // In web mode, fsPath might be undefined for non-file:// URIs
    // Use fsPath if available, otherwise fall back to URI path
    const folderPath = folder.uri.fsPath ?? folder.uri.path;
    if (folderPath) {
      workspaceUris.push(folderPath);
    }
  });

  // For workspace type detection, we still need to check the file system
  // Create a temporary provider just for detection
  // In web mode with no valid paths, default to UNKNOWN
  const workspaceType: lspCommon.WorkspaceType =
    workspaceUris.length > 0 ? await detectWorkspaceType(workspaceUris) : 'UNKNOWN';

  // Check if we have a valid project structure
  if (getActivationMode() === 'autodetect' && !lspCommon.isLWC(workspaceType)) {
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
    const serverPathArray = ['dist', 'web', 'lwcServer.js'];
    const serverPathUri = Uri.joinPath(extensionContext.extensionUri, ...serverPathArray);
    serverModule = serverPathUri.toString();
  } else {
    // For Node.js mode, use the file system path
    // Dynamically import path only in Node.js mode to avoid bundling issues in web mode
    const { join } = await import('node:path');
    serverModule = extensionContext.asAbsolutePath(join(...serverPath));
  }

  try {
    const client = await createLanguageClient(serverModule, { workspaceType });

    // Start the client and add it to subscriptions
    channelService.appendLine('Starting LWC Language Server...');

    try {
      await client.start();
      channelService.appendLine('LWC Language Server client started');
    } catch (startError) {
      const errorMsg = `[LWC] Failed to start client: ${startError instanceof Error ? startError.message : String(startError)}`;
      channelService.appendLine(errorMsg);
      throw startError;
    }

    // Enable verbose tracing to see server logs in the output channel
    // This will show logs from the language server itself
    // Note: setTrace may return a promise or void
    try {
      const traceResult = client.setTrace(1); // Trace.Verbose - shows all LSP protocol messages
      if (
        traceResult &&
        typeof traceResult === 'object' &&
        'then' in traceResult &&
        typeof traceResult.then === 'function'
      ) {
        void traceResult.catch(() => {
          // Tracing failed silently - it's optional
        });
      }
    } catch {
      // Don't throw - tracing is optional
    }

    extensionContext.subscriptions.push(client);
    channelService.appendLine('LWC Language Server started successfully');
    channelService.appendLine('Check "LWC Language Server" output channel for server logs');

    // Load essential JSON/XML files for workspace type detection
    // This must run AFTER the language client is started so that didOpen notifications are sent
    // Only load the specific files checked by detectWorkspaceHelper at root level:
    // - sfdx-project.json, workspace-user.xml, lwc.config.json, package.json, lerna.json (at root)
    // Note: Parent workspace-user.xml check is handled by language server code, not via file glob
    const bootstrapConfigFiles = async () => {
      channelService.appendLine('[LWC Bootstrap Config] Starting bootstrap for config files...');
      channelService.appendLine(`[LWC Bootstrap Config] Workspace folders: ${workspace.workspaceFolders?.length ?? 0}`);

      if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
        // Bootstrap each workspace folder separately
        const bootstrapPromises = workspace.workspaceFolders.map(async folder => {
          channelService.appendLine(`[LWC Bootstrap Config] Workspace folder: ${folder.uri.toString()}`);

          // In web mode, findFiles with memfs:// URIs can hang, so construct URIs directly
          // and pass them to bootstrapWorkspaceAwareness to skip findFiles
          const configFiles = [
            'sfdx-project.json',
            'workspace-user.xml',
            'lwc.config.json',
            'package.json',
            'lerna.json'
          ];
          
          // Construct URIs for config files and check which ones exist
          const configUris: Uri[] = [];
          for (const configFile of configFiles) {
            const configUri = Uri.joinPath(folder.uri, configFile);
            try {
              await workspace.fs.stat(configUri);
              configUris.push(configUri);
              channelService.appendLine(`[LWC Bootstrap Config] ${folder.name}: Found ${configFile}`);
            } catch {
              // File doesn't exist - skip it
            }
          }
          
          if (configUris.length > 0) {
            // Use bootstrapWorkspaceAwareness with provided URIs to skip findFiles
            await Effect.runPromise(
              bootstrapWorkspaceAwareness({
                fileGlob: '{sfdx-project.json,workspace-user.xml,lwc.config.json,package.json,lerna.json}',
                excludeGlob: '**/{node_modules,.sfdx,.git,dist,out,lib,coverage}/**',
                uris: configUris,
                logger: (msg: string) => {
                  channelService.appendLine(`[LWC Bootstrap Config] ${folder.name}: ${msg}`);
                }
              })
            );
            channelService.appendLine(`[LWC Bootstrap Config] ${folder.name}: Config files bootstrap completed`);
          } else {
            channelService.appendLine(`[LWC Bootstrap Config] ${folder.name}: No config files found`);
          }
        });

        await Promise.all(bootstrapPromises);
        channelService.appendLine('[LWC Bootstrap Config] Config files bootstrap completed');
      }
    };

    // Start bootstrap after client is started
    void bootstrapConfigFiles();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    channelService.appendLine(`Failed to start LWC Language Server: ${errorMessage}`);
    throw error; // Re-throw to prevent silent failures
  }

  // Trigger loading of workspace files into document cache after server initialization
  // This runs asynchronously and does not block extension activation
  // The language server uses scheduleReinitialization to wait for file loading to stabilize
  void Effect.runPromise(
    bootstrapWorkspaceAwareness({
      fileGlob: '**/lwc/**/*.{js,ts,html}',
      excludeGlob: '**/{node_modules,.sfdx,.git,dist,out,lib,coverage}/**',
      logger: (msg: string) => {
        channelService.appendLine(`[LWC Bootstrap] ${msg}`);
      }
    })
  )
    .then(() => {
      channelService.appendLine('[LWC] Workspace files loaded into document cache');
    })
    .catch((error: unknown) => {
      const errorMsg = `Failed to bootstrap workspace awareness: ${String(error)}`;
      channelService.appendLine(`[LWC] ERROR: ${errorMsg}`);
    });

  // Creates resources for js-meta.xml to work
  await metaSupport.getMetaSupport();

  // Watch for newly created LWC files and auto-open them to trigger delayed initialization
  // This handles the case where files are downloaded from org browser after server starts
  // Opening files syncs them to the server via onDidOpen, which triggers delayed initialization
  const lwcFileWatcher = workspace.createFileSystemWatcher('**/lwc/**/*.{js,ts,html,js-meta.xml}');
  lwcFileWatcher.onDidCreate(async uri => {
    // Auto-open newly created LWC files in the background
    // This ensures they're synced to the language server via onDidOpen
    // The server will trigger delayed initialization once files are available
    try {
      await workspace.openTextDocument(uri);
      // Don't show the document, just open it in the background to sync to server
      // This ensures the file is available to the language server
    } catch {
      // Failed to open file - continue silently
    }
  });
  extensionContext.subscriptions.push(lwcFileWatcher);

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

  // Initialize utils for user settings
  WorkspaceUtils.instance.init(extensionContext);

  // Notify telemetry that our extension is now active
  void activateTracker.markActivationStop();

  channelService.appendLine('Lightning Web Components extension activation complete.');
};

export const deactivate = async () => {
  if (DevServerService.instance.isServerHandlerRegistered()) {
    await DevServerService.instance.stopServer();
  }
  // Get telemetry service for deactivation (no-op in web mode)
  const telemetryService = await getTelemetryService();
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
