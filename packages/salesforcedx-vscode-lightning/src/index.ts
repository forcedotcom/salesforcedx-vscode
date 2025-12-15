/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DirectoryEntry, FileSystemDataProvider, isLWC } from '@salesforce/salesforcedx-lightning-lsp-common';
import {
  bootstrapWorkspaceAwareness,
  detectWorkspaceType,
  TelemetryService,
  TimingUtils
} from '@salesforce/salesforcedx-utils-vscode';
import { Effect } from 'effect';
import { log } from 'node:console';
import * as path from 'node:path';
import { ExtensionContext, Uri, workspace, FileType } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  RevealOutputChannelOn,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';
import { nls } from './messages';

const getActivationMode = (): string => {
  const config = workspace.getConfiguration('salesforcedx-vscode-lightning');
  return config.get('activationMode') ?? 'autodetect'; // default to autodetect
};

export const activate = async (extensionContext: ExtensionContext) => {
  const extensionStartTime = TimingUtils.getCurrentTime();

  // Run our auto detection routine before we activate
  // 1) If activationMode is off, don't startup no matter what
  if (getActivationMode() === 'off') {
    log('Aura Language Server activationMode set to off, exiting...');
    return;
  }

  // 2) if we have no workspace folders, exit
  if (!workspace.workspaceFolders) {
    log('No workspace, exiting extension');
    return;
  }

  // Pass the workspace folder URIs to the language server
  const workspaceUris: string[] = [];
  workspace.workspaceFolders.forEach(folder => {
    workspaceUris.push(folder.uri.fsPath);
  });

  // Create FileSystemDataProvider with Aura resources and essential workspace files for the language server
  const fileSystemProvider = await createAuraResourcesProvider(extensionContext);

  // 3) If activationMode is autodetect or always, check workspaceType before startup
  const workspaceType = await detectWorkspaceType(workspaceUris);

  // Check if we have a valid project structure
  if (getActivationMode() === 'autodetect' && !isLWC(workspaceType)) {
    // If activationMode === autodetect and we don't have a valid workspace type, exit
    log(
      `Aura LSP - autodetect did not find a valid project structure, exiting.... WorkspaceType detected: ${workspaceType}`
    );
    return;
  }

  // Initialize telemetry service
  await TelemetryService.getInstance().initializeService(extensionContext);

  // Start the Aura Language Server
  const serverPath = extensionContext.extension.packageJSON.serverPath;
  const serverModule = extensionContext.asAbsolutePath(path.join(...serverPath));

  // The debug options for the server
  const debugOptions = {
    execArgv: ['--nolazy', '--inspect=6020']
  };

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

  // Setup our fileSystemWatchers
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      {
        language: 'html',
        scheme: 'file'
      },
      {
        language: 'html',
        scheme: 'untitled'
      },
      { language: 'javascript', scheme: 'file' },
      { language: 'javascript', scheme: 'untitled' },
      // Include json and xml to receive onDidOpen events for workspace configuration files
      { language: 'json', scheme: 'file' },
      { language: 'xml', scheme: 'file' }
    ],
    initializationOptions: {
      // static Aura resources for the language server, not the entire workspace
      fileSystemProvider: fileSystemProvider.serialize(),
      workspaceType
    },
    revealOutputChannelOn: RevealOutputChannelOn.Error,
    synchronize: {
      fileEvents: [
        workspace.createFileSystemWatcher('**/*.resource'),
        workspace.createFileSystemWatcher('**/labels/CustomLabels.labels-meta.xml'),
        workspace.createFileSystemWatcher('**/aura/*/*.{cmp,app,intf,evt,js}'),
        workspace.createFileSystemWatcher('**/components/*/*/*.{cmp,app,intf,evt,lib,js}'),
        // need to watch for directory deletions as no events are created for contents or deleted directories
        workspace.createFileSystemWatcher('**/', true, true, false),

        // these need to be handled because we also maintain a lwc index for interop
        workspace.createFileSystemWatcher('**/staticresources/*.resource-meta.xml'),
        workspace.createFileSystemWatcher('**/contentassets/*.asset-meta.xml'),
        workspace.createFileSystemWatcher('**/lwc/*/*.js'),
        workspace.createFileSystemWatcher('**/modules/*/*/*.js')
      ]
    }
  };

  // Create the language client and start the client.
  const client = new LanguageClient('auraLanguageServer', nls.localize('client_name'), serverOptions, clientOptions);
  console.log(`Server module path: ${serverModule}`);

  // Start the language server
  try {
    await client.start();
    console.log('Aura Language Server started successfully');
  } catch (error) {
    const errorMessage = `Failed to start Aura Language Server: ${String(error)}`;
    log(errorMessage);
    throw error;
  }

  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  extensionContext.subscriptions.push(client);

  // Trigger loading of workspace files into document cache after server initialization
  // This runs asynchronously and does not block extension activation
  void Effect.runPromise(
    bootstrapWorkspaceAwareness({
      fileGlob: '**/aura/**/*.{cmp,app,intf,evt,js}',
      excludeGlob: '**/{node_modules,.sfdx,.git,dist,out,lib,coverage}/**',
      logger: log
    })
  ).catch((error: unknown) => {
    log(`Failed to bootstrap workspace awareness: ${String(error)}`);
  });

  // Also load essential JSON files for workspace type detection
  // Use **/*.{json,xml} to match root-level files like sfdx-project.json
  log('Starting to load essential JSON/XML files...');
  void Effect.runPromise(
    bootstrapWorkspaceAwareness({
      fileGlob: '**/*.{json,xml}',
      excludeGlob: '**/{node_modules,.sfdx,.git,dist,out,lib,coverage}/**',
      logger: log
    })
  )
    .then(() => {
      log('Successfully loaded essential JSON/XML files');
    })
    .catch((error: unknown) => {
      log(`Failed to bootstrap essential files: ${String(error)}`);
    });

  // finising up with workspace awareness
  log('Finished with workspace awareness');

  // Notify telemetry that our extension is now active
  TelemetryService.getInstance().sendExtensionActivationEvent(extensionStartTime);
};

export const deactivate = () => {
  console.log('Aura Components Extension Deactivated');
  TelemetryService.getInstance().sendExtensionDeactivationEvent();
};

/**
 * Creates a FileSystemDataProvider with Aura framework resources and essential workspace files
 */
const createAuraResourcesProvider = async (extensionContext: ExtensionContext): Promise<FileSystemDataProvider> => {
  const provider = new FileSystemDataProvider();

  // Load Aura framework resources from extension
  // In packaged extension: dist/resources/aura (copied during bundling)
  // In development: dist/resources/aura exists if bundling ran, otherwise fall back to src/resources/aura
  const extensionPath = extensionContext.extensionPath;
  // Try dist first (packaged or development with bundling), then fall back to src (development without bundling)
  const distResourcesPath = path.join(extensionPath, 'dist', 'resources', 'aura');
  const srcResourcesPath = path.join(extensionPath, 'src', 'resources', 'aura');

  let auraResourcesPath: string;
  try {
    await workspace.fs.stat(Uri.file(distResourcesPath));
    auraResourcesPath = distResourcesPath;
  } catch {
    // dist/resources/aura doesn't exist (development mode without bundling), try src/resources/aura
    auraResourcesPath = srcResourcesPath;
  }

  await loadAuraResourcesRecursively(provider, auraResourcesPath);

  return provider;
};

/**
 * Attempts to read a file and add it to the provider if it exists
 * Used for loading Aura framework resources
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
  } catch (error: unknown) {
    // File doesn't exist or can't be read - this is expected for some files
    if (!(error instanceof Error) || !error.message.includes('ENOENT')) {
      log(`Unexpected error reading file ${filePath}: ${String(error)}`);
    }
  }
};

/**
 * Loads Aura resources recursively from the extension's resources directory
 * Uses fsPath format (no file:// prefix) to match LWC server behavior
 */
const loadAuraResourcesRecursively = async (provider: FileSystemDataProvider, dirPath: string): Promise<void> => {
  try {
    const dirUri = Uri.file(dirPath);
    const entries = await workspace.fs.readDirectory(dirUri);

    // Update directory listing
    const directoryEntries = entries.map(
      ([name, type]: [string, number]): DirectoryEntry => ({
        name,
        type: type === 1 ? 'file' : 'directory', // FileType.File = 1, FileType.Directory = 2
        uri: path.join(dirPath, name)
      })
    );
    provider.updateDirectoryListing(dirPath, directoryEntries);

    // Update directory stat
    provider.updateFileStat(dirPath, {
      type: 'directory',
      exists: true,
      ctime: Date.now(),
      mtime: Date.now(),
      size: 0 // Directories don't have a meaningful size
    });

    // Process each entry
    for (const [name, type] of entries) {
      const entryPath = path.join(dirPath, name);

      if (type === FileType.File) {
        await tryReadFile(provider, entryPath);
      } else if (type === FileType.Directory) {
        // Skip common directories that don't need to be populated
        if (shouldSkipDirectory(name)) {
          continue;
        }
        await loadAuraResourcesRecursively(provider, entryPath);
      }
    }
  } catch (error: any) {
    // Directory doesn't exist or can't be read
    if (!(error instanceof Error) || !error.message.includes('ENOENT')) {
      log(`Unexpected error reading directory ${dirPath}: ${String(error)}`);
      throw error;
    }
  }
};

/**
 * Determines if a directory should be skipped during workspace population
 * @param dirName Name of the directory
 * @returns true if directory should be skipped
 */
const shouldSkipDirectory = (dirName: string): boolean => {
  const skipDirs = [
    'node_modules',
    '.git',
    '.vscode',
    '.sfdx',
    'coverage',
    'dist',
    'out',
    'lib',
    '.nyc_output',
    'temp',
    'tmp',
    '.DS_Store'
  ];
  return skipDirs.includes(dirName) || dirName.startsWith('.');
};
