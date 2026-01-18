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

// Lazy telemetry service getter - only loads telemetry module when not in web mode
const getTelemetryService = async (): Promise<TelemetryServiceInterface> => {
  if (process.env.ESBUILD_PLATFORM === 'web') {
    // Import web-specific no-op telemetry service (doesn't import applicationinsights)
    const { telemetryService } = await import('./telemetry/web.js');
    return telemetryService;
  }
  // Dynamically import telemetry only when needed (not in web mode)
  const telemetryModule = await import('./telemetry/index.js');
  return telemetryModule.telemetryService;
};

// Track if we've already activated to avoid duplicate activation
let isActivated = false;

const performActivation = async (extensionContext: ExtensionContext) => {
  console.log('[LWC] performActivation called, isActivated:', isActivated);
  // If already activated, don't activate again
  if (isActivated) {
    const msg = '[DEBUG] Extension already activated, skipping duplicate activation';
    console.log(msg);
    log(msg);
    return;
  }

  // Get telemetry service (lazy load - no-op in web mode)
  const telemetryService = await getTelemetryService();
  const activateTracker = new ActivationTracker(extensionContext, telemetryService);

  log(`Activation Mode: ${getActivationMode()}`);
  channelService.appendLine(`Activation Mode: ${getActivationMode()}`);
  // Run our auto detection routine before we activate
  // If activationMode is off, don't startup no matter what
  if (getActivationMode() === 'off') {
    const msg = 'LWC Language Server activationMode set to off, exiting...';
    log(msg);
    channelService.appendLine(msg);
    return;
  }

  // Initialize telemetry service (no-op in web mode)
  if (process.env.ESBUILD_PLATFORM === 'web') {
    log('Skipping telemetry initialization (web mode - AppInsights not available)');
    channelService.appendLine('Skipping telemetry initialization (web mode - AppInsights not available)');
  } else {
    try {
      await telemetryService.initializeService(extensionContext);
    } catch (e) {
      const errorMsg = `Failed to initialize telemetry service: ${String(e)}`;
      log(errorMsg);
      channelService.appendLine(errorMsg);
      // Continue without telemetry if initialization fails
      log('Continuing without telemetry service');
      channelService.appendLine('Continuing without telemetry service');
    }
  }

  // Debug workspace state
  log(`[DEBUG] workspace.workspaceFolders: ${workspace.workspaceFolders ? 'exists' : 'undefined'}`);
  log(`[DEBUG] workspace.workspaceFolders?.length: ${workspace.workspaceFolders?.length ?? 'N/A'}`);
  log(`[DEBUG] workspace.name: ${workspace.name ?? 'undefined'}`);
  log(`[DEBUG] workspace.workspaceFile: ${workspace.workspaceFile?.toString() ?? 'undefined'}`);

  // In web mode, workspace folders might not be available immediately
  // Wait a bit for them to load if they're not available yet
  if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
    log('[DEBUG] No workspace folders found, waiting up to 2 seconds for them to load...');
    // Wait for workspace folders with a timeout
    const maxWaitTime = 2000; // 2 seconds
    const checkInterval = 100; // Check every 100ms
    let waited = 0;
    while ((!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) && waited < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }
    log(`[DEBUG] After waiting ${waited}ms, workspace folders: ${workspace.workspaceFolders?.length ?? 0}`);
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
  log(`[DEBUG] Workspace folders count: ${workspace.workspaceFolders.length}`);
  workspace.workspaceFolders.forEach((folder, index) => {
    // In web mode, fsPath might be undefined for non-file:// URIs
    // Use fsPath if available, otherwise fall back to URI path
    const folderPath = folder.uri.fsPath ?? folder.uri.path;
    log(
      `[DEBUG] Workspace folder ${index}: uri=${folder.uri.toString()}, fsPath=${folder.uri.fsPath ?? 'undefined'}, path=${folder.uri.path ?? 'undefined'}, extractedPath=${folderPath ?? 'undefined'}`
    );
    if (folderPath) {
      workspaceUris.push(folderPath);
    } else {
      // If we can't get a path, log a warning but continue
      log(`Warning: Could not determine path for workspace folder: ${folder.uri.toString()}`);
    }
  });

  log(`[DEBUG] Workspace URIs to check: ${JSON.stringify(workspaceUris)}`);
  log(`[DEBUG] Workspace URIs count: ${workspaceUris.length}`);

  // For workspace type detection, we still need to check the file system
  // Create a temporary provider just for detection
  // In web mode with no valid paths, default to UNKNOWN
  let workspaceType: lspCommon.WorkspaceType;
  if (workspaceUris.length > 0) {
    log(`[DEBUG] Calling detectWorkspaceType with ${workspaceUris.length} workspace root(s)`);
    workspaceType = await detectWorkspaceType(workspaceUris);
    log(`[DEBUG] detectWorkspaceType returned: ${workspaceType}`);
  } else {
    log('[DEBUG] No workspace URIs available, defaulting to UNKNOWN');
    workspaceType = 'UNKNOWN';
  }

  // Check if we have a valid project structure
  if (getActivationMode() === 'autodetect' && !lspCommon.isLWC(workspaceType)) {
    // If activationMode === autodetect and we don't have a valid workspace type, exit
    const msg1 = 'LWC LSP - autodetect did not find a valid project structure, exiting....';
    const msg2 = `WorkspaceType detected: ${workspaceType}`;
    log(msg1);
    log(msg2);
    channelService.appendLine(msg1);
    channelService.appendLine(msg2);
    return;
  }

  // Start the LWC Language Server
  log('[LWC] Starting LWC Language Server...');
  const serverPath = extensionContext.extension.packageJSON.serverPath;
  let serverModule: string;
  if (process.env.ESBUILD_PLATFORM === 'web') {
    // For web mode, use the browser bundle and convert to URI
    const serverPathArray = ['dist', 'web', 'lwcServer.js'];
    const serverPathUri = Uri.joinPath(extensionContext.extensionUri, ...serverPathArray);
    serverModule = serverPathUri.toString();
    log(`[LWC] Web mode: Server module URI: ${serverModule}`);
  } else {
    // For Node.js mode, use the file system path
    // Dynamically import path only in Node.js mode to avoid bundling issues in web mode
    const { join } = await import('node:path');
    serverModule = extensionContext.asAbsolutePath(join(...serverPath));
    log(`[LWC] Node mode: Server module path: ${serverModule}`);
  }

  try {
    log(`[LWC] Creating language client with workspaceType: ${workspaceType}`);
    const client = await createLanguageClient(serverModule, { workspaceType });
    log('[LWC] Language client created successfully');

    // Start the client and add it to subscriptions
    log('[LWC] Starting language client...');
    channelService.appendLine('Starting LWC Language Server...');

    try {
      await client.start();
      log('[LWC] Language client started successfully');
      channelService.appendLine('LWC Language Server client started');
    } catch (startError) {
      const errorMsg = `[LWC] Failed to start client: ${startError instanceof Error ? startError.message : String(startError)}`;
      log(errorMsg);
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
        void traceResult.catch((traceError: unknown) => {
          log(`[LWC] Failed to set trace: ${traceError instanceof Error ? traceError.message : String(traceError)}`);
        });
      }
      log('[LWC] Verbose tracing enabled');
    } catch (traceError) {
      log(`[LWC] Failed to set trace: ${traceError instanceof Error ? traceError.message : String(traceError)}`);
      // Don't throw - tracing is optional
    }

    extensionContext.subscriptions.push(client);
    isActivated = true;
    log('[LWC] LWC Language Server started successfully');
    channelService.appendLine('LWC Language Server started successfully');
    channelService.appendLine('Check "LWC Language Server" output channel for server logs');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    log(`[LWC] ERROR: Failed to start LWC Language Server: ${errorMessage}`);
    if (errorStack) {
      log(`[LWC] ERROR Stack: ${errorStack}`);
    }
    channelService.appendLine(`Failed to start LWC Language Server: ${errorMessage}`);
    throw error; // Re-throw to prevent silent failures
  }

  // Trigger loading of workspace files into document cache after server initialization
  // This runs asynchronously and does not block extension activation
  // The language server uses scheduleReinitialization to wait for file loading to stabilize
  log('[LWC] Starting bootstrapWorkspaceAwareness for LWC files...');
  void Effect.runPromise(
    bootstrapWorkspaceAwareness({
      fileGlob: '**/lwc/**/*.{js,ts,html}',
      excludeGlob: '**/{node_modules,.sfdx,.git,dist,out,lib,coverage}/**',
      logger: (msg: string) => {
        log(`[LWC Bootstrap] ${msg}`);
        channelService.appendLine(`[LWC Bootstrap] ${msg}`);
      }
    })
  )
    .then(() => {
      log('[LWC] bootstrapWorkspaceAwareness completed successfully');
      channelService.appendLine('[LWC] Workspace files loaded into document cache');
    })
    .catch((error: unknown) => {
      const errorMsg = `Failed to bootstrap workspace awareness: ${String(error)}`;
      log(`[LWC] ERROR: ${errorMsg}`);
      channelService.appendLine(`[LWC] ERROR: ${errorMsg}`);
      if (error instanceof Error && error.stack) {
        log(`[LWC] ERROR Stack: ${error.stack}`);
      }
    });

  // Also load essential JSON/XML files for workspace type detection
  // Only load the specific files checked by detectWorkspaceHelper at root level:
  // - sfdx-project.json, workspace-user.xml, lwc.config.json, package.json, lerna.json (at root)
  // Note: Parent workspace-user.xml check is handled by language server code, not via file glob
  // Using patterns without **/ to match only at root level of each workspace folder
  void Effect.runPromise(
    bootstrapWorkspaceAwareness({
      fileGlob: '{sfdx-project.json,workspace-user.xml,lwc.config.json,package.json,lerna.json}',
      excludeGlob: '**/{node_modules,.sfdx,.git,dist,out,lib,coverage}/**',
      logger: log
    })
  )
    .then(() => {
      log('[LWC] Essential files bootstrap completed');
    })
    .catch((error: unknown) => {
      log(`Failed to bootstrap essential files: ${String(error)}`);
      // If findFiles fails (common in web mode), explicitly try to open sfdx-project.json
      // This is critical for delayed initialization which needs to read the config
      if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
        for (const folder of workspace.workspaceFolders) {
          const sfdxProjectUri = Uri.joinPath(folder.uri, 'sfdx-project.json');
          void (async () => {
            try {
              await workspace.openTextDocument(sfdxProjectUri);
              log('[LWC] sfdx-project.json opened successfully as fallback');
            } catch {
              // File might not exist - this is okay for non-SFDX projects
            }
          })();
        }
      }
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
      log(`[LWC] Auto-opening newly created LWC file: ${uri.fsPath}`);
      await workspace.openTextDocument(uri);
      // Don't show the document, just open it in the background to sync to server
      // This ensures the file is available to the language server
      log(`[LWC] File opened in background (synced to server): ${uri.fsPath}`);
    } catch (error) {
      log(`[LWC] Failed to auto-open file ${uri.fsPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  extensionContext.subscriptions.push(lwcFileWatcher);
  log('[LWC] File watcher set up to auto-open newly created LWC files');

  // Activate Test support (skip in web mode - test execution requires Node.js/terminal)
  if (process.env.ESBUILD_PLATFORM !== 'web') {
    try {
      // Lazy load test support to avoid bundling jest-editor-support in web mode
      const testSupport = await import('./testSupport/index.js');

      if (testSupport.shouldActivateLwcTestSupport(workspaceType)) {
        testSupport.activateLwcTestSupport(extensionContext, workspaceType);
      }
    } catch (e) {
      log(`Failed to load test support: ${String(e)}`);
      channelService.appendLine(`Failed to load test support: ${String(e)}`);
    }
  }

  // Initialize utils for user settings
  WorkspaceUtils.instance.init(extensionContext);

  // Notify telemetry that our extension is now active
  void activateTracker.markActivationStop();

  const activationCompleteMsg = 'Lightning Web Components extension activation complete.';
  log(activationCompleteMsg);
  channelService.appendLine(activationCompleteMsg);
};

export const activate = async (extensionContext: ExtensionContext) => {
  // Log immediately to browser console - this should always appear if extension loads
  console.log('[LWC] Extension activate() called');
  console.log('[LWC] Extension context:', extensionContext.extension.id);

  log('Lightning Web Components extension activating...');
  try {
    channelService.appendLine('Lightning Web Components extension activating...');
  } catch (e) {
    console.error('[LWC] Failed to append to channel:', e);
  }

  // Register commands (only once)
  const ourCommands = registerCommands(extensionContext);
  extensionContext.subscriptions.push(ourCommands);

  // Try to activate immediately if workspace folders are available
  await performActivation(extensionContext);

  // Listen for workspace folder changes (important for web mode where folders are added after initial activation)
  extensionContext.subscriptions.push(
    workspace.onDidChangeWorkspaceFolders(async event => {
      const msg = `[DEBUG] Workspace folders changed. Added: ${event.added.length}, Removed: ${event.removed.length}`;
      console.log(msg);
      log(msg);
      if (event.added.length > 0 && !isActivated) {
        const activateMsg = '[DEBUG] Workspace folders added, attempting activation...';
        console.log(activateMsg);
        log(activateMsg);
        await performActivation(extensionContext);
      }
    })
  );
};

export const deactivate = async () => {
  if (DevServerService.instance.isServerHandlerRegistered()) {
    await DevServerService.instance.stopServer();
  }
  log('Lightning Web Components Extension Deactivated');
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
