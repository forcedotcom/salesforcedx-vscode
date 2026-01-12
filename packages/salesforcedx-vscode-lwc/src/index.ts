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
import * as path from 'node:path';
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

export const activate = async (extensionContext: ExtensionContext) => {
  // Log immediately to browser console - this should always appear if extension loads
  console.log('[LWC] Extension activate() called');
  console.log('[LWC] Extension context:', extensionContext.extension.id);

  // Get telemetry service (lazy load - no-op in web mode)
  const telemetryService = await getTelemetryService();
  const activateTracker = new ActivationTracker(extensionContext, telemetryService);

  log('Lightning Web Components extension activating...');
  try {
    channelService.appendLine('Lightning Web Components extension activating...');
  } catch (e) {
    console.error('[LWC] Failed to append to channel:', e);
  }
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

  // if we have no workspace folders, exit
  if (!workspace.workspaceFolders) {
    const msg = 'No workspace, exiting extension';
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
    } else {
      // If we can't get a path, log a warning but continue
      log(`Warning: Could not determine path for workspace folder: ${folder.uri.toString()}`);
    }
  });

  // For workspace type detection, we still need to check the file system
  // Create a temporary provider just for detection
  // In web mode with no valid paths, default to UNKNOWN
  const workspaceType = workspaceUris.length > 0 ? await detectWorkspaceType(workspaceUris) : 'UNKNOWN';

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

  // register commands
  const ourCommands = registerCommands(extensionContext);
  extensionContext.subscriptions.push(ourCommands);

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
    serverModule = extensionContext.asAbsolutePath(path.join(...serverPath));
  }
  const client = createLanguageClient(serverModule, { workspaceType });

  // Start the client and add it to subscriptions
  await client.start();
  extensionContext.subscriptions.push(client);

  // Trigger loading of workspace files into document cache after server initialization
  // This runs asynchronously and does not block extension activation
  // The language server uses scheduleReinitialization to wait for file loading to stabilize
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
      fileGlob: '**/*.{json,xml}',
      excludeGlob: '**/{node_modules,.sfdx,.git,dist,out,lib,coverage}/**',
      logger: log
    })
  ).catch((error: unknown) => {
    log(`Failed to bootstrap essential files: ${String(error)}`);
  });

  // Creates resources for js-meta.xml to work
  await metaSupport.getMetaSupport();

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
