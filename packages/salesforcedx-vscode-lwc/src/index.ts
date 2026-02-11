/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as lspCommon from '@salesforce/salesforcedx-lightning-lsp-common';
import {
  bootstrapWorkspaceAwareness,
  type BootstrapOptions
} from '@salesforce/salesforcedx-lightning-lsp-common/workspaceLoader';
import { ActivationTracker, detectWorkspaceType } from '@salesforce/salesforcedx-utils-vscode';
import type { TelemetryServiceInterface } from '@salesforce/vscode-service-provider';
import { Effect } from 'effect';
import { commands, Disposable, ExtensionContext, FileType, workspace } from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { channelService } from './channel';
import { lightningLwcOpen, lightningLwcPreview, lightningLwcStart, lightningLwcStop } from './commands';
import { createLanguageClient } from './languageClient';
import { metaSupport } from './metasupport';
import { DevServerService } from './service/devServerService';
// Test support is lazy-loaded to avoid bundling jest-editor-support in web mode
import { startLwcFileWatcherViaServices } from './util/lwcFileWatcher';
import { WorkspaceUtils } from './util/workspaceUtils';

// Get telemetry service - now works in both Node.js and web mode
const getTelemetryService = async (): Promise<TelemetryServiceInterface> => {
  const telemetryModule = await import('./telemetry/index.js');
  return telemetryModule.telemetryService;
};

const LWC_BOOTSTRAP_EXCLUDE = new Set(['node_modules', '.sfdx', '.git', 'dist', 'out', 'lib', 'coverage']);
const LWC_EXT = new Set(['.js', '.ts', '.html']);

/**
 * Recursively collect URIs for LWC files (js, ts, html under an lwc dir) via workspace.fs.
 * Used in web mode when findFiles is unreliable (e.g. memfs).
 */
const collectLwcFileUris = async (folderUri: URI): Promise<URI[]> => {
  const entries = await workspace.fs.readDirectory(folderUri);
  const pathLower = folderUri.path.toLowerCase();
  const inLwcDir = pathLower.includes('/lwc/');
  const uris: URI[] = [];

  for (const [name, type] of entries) {
    if (LWC_BOOTSTRAP_EXCLUDE.has(name)) {
      continue;
    }
    const childUri = Utils.joinPath(folderUri, name);
    if (type === FileType.File) {
      const ext = name.includes('.') ? name.substring(name.lastIndexOf('.')) : '';
      if (inLwcDir && LWC_EXT.has(ext.toLowerCase())) {
        uris.push(childUri);
      }
    } else if (type === FileType.Directory) {
      uris.push(...(await collectLwcFileUris(childUri)));
    }
  }
  return uris;
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
  const workspaceType: lspCommon.WorkspaceType =
    workspaceFolderPaths.length > 0 ? await detectWorkspaceType(workspaceFolderPaths) : 'UNKNOWN';

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
    const baseUri = URI.from(extensionContext.extensionUri);
    serverModule = Utils.joinPath(baseUri, 'dist', 'web', 'lwcServer.js').toString();
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

    extensionContext.subscriptions.push(client);
    channelService.appendLine('LWC Language Server started successfully');
    channelService.appendLine('Check "LWC Language Server" output channel for server logs');

    // Load essential JSON/XML files for workspace type detection
    // This must run AFTER the language client is started so that didOpen notifications are sent
    // Only load the specific files checked by detectWorkspaceHelper at root level:
    // - sfdx-project.json, workspace-user.xml, lwc.config.json, package.json, lerna.json (at root)
    // Note: Parent workspace-user.xml check is handled by language server code, not via file glob
    const bootstrapConfigFilesEffect = Effect.gen(function* () {
      yield* Effect.sync(() => {
        channelService.appendLine('[LWC Bootstrap Config] Starting bootstrap for config files...');
        channelService.appendLine(
          `[LWC Bootstrap Config] Workspace folders: ${workspace.workspaceFolders?.length ?? 0}`
        );
      });

      if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
        yield* Effect.all(
          workspace.workspaceFolders.map(folder =>
            Effect.gen(function* () {
              yield* Effect.sync(() =>
                channelService.appendLine(`[LWC Bootstrap Config] Workspace folder: ${folder.uri.toString()}`)
              );

              // In web mode, findFiles with memfs:// URIs does not work
              // hence we pass files directly to bootstrapWorkspaceAwareness to skip findFiles
              const configFiles = [
                'sfdx-project.json',
                'workspace-user.xml',
                'lwc.config.json',
                'package.json',
                'lerna.json'
              ];

              const configUris: URI[] = [];
              for (const configFile of configFiles) {
                const configUri = Utils.joinPath(folder.uri, configFile);
                const statResult = yield* Effect.tryPromise({
                  try: () => workspace.fs.stat(configUri),
                  catch: () => new Error('not found')
                }).pipe(Effect.option);
                if (statResult._tag === 'Some') {
                  configUris.push(configUri);
                  yield* Effect.sync(() =>
                    channelService.appendLine(`[LWC Bootstrap Config] ${folder.name}: Found ${configFile}`)
                  );
                }
              }

              if (configUris.length > 0) {
                yield* bootstrapWorkspaceAwareness({
                  fileGlob: '{sfdx-project.json,workspace-user.xml,lwc.config.json,package.json,lerna.json}',
                  excludeGlob: '**/{node_modules,.sfdx,.git,dist,out,lib,coverage}/**',
                  uris: configUris,
                  logger: (msg: string) => {
                    channelService.appendLine(`[LWC Bootstrap Config] ${folder.name}: ${msg}`);
                  }
                });
                yield* Effect.sync(() =>
                  channelService.appendLine(`[LWC Bootstrap Config] ${folder.name}: Config files bootstrap completed`)
                );
              } else {
                yield* Effect.sync(() =>
                  channelService.appendLine(`[LWC Bootstrap Config] ${folder.name}: No config files found`)
                );
              }
            })
          ),
          { concurrency: 'unbounded' }
        );
        yield* Effect.sync(() => channelService.appendLine('[LWC Bootstrap Config] Config files bootstrap completed'));
      }
    }).pipe(
      Effect.catchAll(error =>
        Effect.sync(() => {
          const errorMsg = `[LWC Bootstrap Config] Failed: ${error instanceof Error ? error.message : String(error)}`;
          channelService.appendLine(errorMsg);
        })
      )
    );

    // Start bootstrap after client is started (daemon fiber, does not block activation)
    Effect.runSync(Effect.forkDaemon(bootstrapConfigFilesEffect));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    channelService.appendLine(`Failed to start LWC Language Server: ${errorMessage}`);
    throw error; // Re-throw to prevent silent failures
  }

  // Trigger loading of workspace files into document cache after server initialization
  // This runs asynchronously and does not block extension activation
  // The language server uses scheduleReinitialization to wait for file loading to stabilize
  void Effect.runPromise(
    Effect.gen(function* () {
      let lwcUris: URI[] | undefined;
      if (process.env.ESBUILD_PLATFORM === 'web' && workspace.workspaceFolders?.length) {
        const perFolder = yield* Effect.tryPromise({
          try: () => Promise.all(workspace.workspaceFolders!.map(folder => collectLwcFileUris(folder.uri))),
          catch: (e: unknown) => new Error(e instanceof Error ? e.message : String(e))
        });
        lwcUris = perFolder.flat();
      }

      const options: BootstrapOptions = {
        fileGlob: '**/lwc/**/*.{js,ts,html}',
        excludeGlob: '**/{node_modules,.sfdx,.git,dist,out,lib,coverage}/**',
        logger: (msg: string) => {
          channelService.appendLine(`[LWC Bootstrap] ${msg}`);
        },
        uris: lwcUris
      };

      yield* bootstrapWorkspaceAwareness(options);
    }).pipe(
      Effect.catchAll(error =>
        Effect.sync(() => {
          const message = error instanceof Error ? error.message : String(error);
          channelService.appendLine(`[LWC] ERROR: Failed to bootstrap workspace awareness: ${message}`);
        })
      )
    )
  );

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
