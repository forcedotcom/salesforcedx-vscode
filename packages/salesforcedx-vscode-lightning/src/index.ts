/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  detectWorkspaceType,
  DirectoryEntry,
  FileSystemDataProvider,
  isLWC
} from '@salesforce/salesforcedx-lightning-lsp-common';
import { TelemetryService, TimingUtils } from '@salesforce/salesforcedx-utils-vscode';
import { log } from 'node:console';
import * as path from 'node:path';
import { ExtensionContext, Uri, workspace, FileType } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
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
    console.log('Aura Language Server activationMode set to off, exiting...');
    return;
  }

  // 2) if we have no workspace folders, exit
  if (!workspace.workspaceFolders) {
    console.log('No workspace, exiting extension');
    return;
  }

  // Pass the workspace folder URIs to the language server
  const workspaceUris: string[] = [];
  workspace.workspaceFolders.forEach(folder => {
    workspaceUris.push(folder.uri.fsPath);
  });

  // Create a FileSystemDataProvider with workspace files for the language server
  const serverFileSystemProvider = await createFileSystemProvider(workspaceUris);

  // 3) If activationMode is autodetect or always, check workspaceType before startup
  const workspaceType = await detectWorkspaceType(workspaceUris, serverFileSystemProvider);

  // Check if we have a valid project structure
  if (getActivationMode() === 'autodetect' && !isLWC(workspaceType)) {
    // If activationMode === autodetect and we don't have a valid workspace type, exit
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
      { language: 'javascript', scheme: 'untitled' }
    ],
    initializationOptions: {
      fileSystemProvider: serverFileSystemProvider.serialize()
    },
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

  // Start the language server
  await client.start();

  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  extensionContext.subscriptions.push(client);

  // Notify telemetry that our extension is now active
  TelemetryService.getInstance().sendExtensionActivationEvent(extensionStartTime);
};

export const deactivate = () => {
  console.log('Aura Components Extension Deactivated');
  TelemetryService.getInstance().sendExtensionDeactivationEvent();
};

/**
 * Creates a FileSystemDataProvider that reads all workspace files and directories
 * @param workspaceUris Array of workspace folder paths
 * @returns FileSystemDataProvider with workspace files and directories
 */
const createFileSystemProvider = async (workspaceUris: string[]): Promise<FileSystemDataProvider> => {
  const fileSystemProvider = new FileSystemDataProvider();

  for (const workspaceUri of workspaceUris) {
    await populateWorkspaceRecursively(fileSystemProvider, workspaceUri);
  }

  // Add resources directory from the bundled extension
  await populateResourcesDirectory(fileSystemProvider);

  return fileSystemProvider;
};

/**
 * Recursively populates all files and directories in the workspace
 * @param provider FileSystemDataProvider to populate
 * @param dirPath Path to the directory to populate
 */
const populateWorkspaceRecursively = async (provider: FileSystemDataProvider, dirPath: string): Promise<void> => {
  try {
    const dirUri = Uri.parse(dirPath);
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
        await populateWorkspaceRecursively(provider, entryPath);
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

/**
 * Populates the resources directory from the bundled extension
 * @param provider FileSystemDataProvider to populate
 */
const populateResourcesDirectory = async (provider: FileSystemDataProvider): Promise<void> => {
  try {
    // We know exactly where the resources are - they're bundled in the extension
    // The resources are copied to dist/resources/aura during the build process
    const extensionPath = path.join(__dirname, '..', '..', 'dist');
    const resourcesDir = path.join(extensionPath, 'resources');
    const auraResourcesDir = path.join(resourcesDir, 'aura');

    // Add directory listings
    provider.updateDirectoryListing(resourcesDir, [{ name: 'aura', type: 'directory', uri: auraResourcesDir }]);

    // Add file stats for directories
    provider.updateFileStat(resourcesDir, {
      type: 'directory',
      exists: true,
      ctime: Date.now(),
      mtime: Date.now(),
      size: 0
    });

    provider.updateFileStat(auraResourcesDir, {
      type: 'directory',
      exists: true,
      ctime: Date.now(),
      mtime: Date.now(),
      size: 0
    });
  } catch (error) {
    log(`Error populating resources directory: ${String(error)}`);
    throw error;
  }
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
