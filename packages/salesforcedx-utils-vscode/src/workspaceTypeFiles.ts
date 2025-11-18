/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { FileSystemDataProvider } from '@salesforce/salesforcedx-lightning-lsp-common';
import * as path from 'node:path';
import { Uri, workspace } from 'vscode';

/**
 * Populates only the files needed for workspace type detection
 * @param provider FileSystemDataProvider to populate
 * @param workspaceRoot Path to the workspace root
 * @param logger Optional logger function for error messages
 */
export const populateWorkspaceTypeFiles = async (
  provider: FileSystemDataProvider,
  workspaceRoot: string,
  logger?: (message: string) => void
): Promise<void> => {
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
    await tryReadFile(provider, filePath, logger);
  }

  // Also try parent workspace-user.xml
  await tryReadFile(provider, parentWorkspaceUserPath, logger);
};

/**
 * Attempts to read a file and add it to the provider if it exists
 * Uses fsPath format (no file:// prefix) to match LWC server behavior
 * @param provider FileSystemDataProvider to update
 * @param filePath Path to the file to read
 * @param logger Optional logger function for error messages
 */
const tryReadFile = async (
  provider: FileSystemDataProvider,
  filePath: string,
  logger?: (message: string) => void
): Promise<void> => {
  try {
    const fileUri = Uri.file(filePath);
    const fileContent = await workspace.fs.readFile(fileUri);
    const content = Buffer.from(fileContent).toString('utf8');

    // Store using fsPath format only (consistent with LWC server)
    provider.updateFileContent(filePath, content);
    provider.updateFileStat(filePath, {
      type: 'file',
      exists: true,
      ctime: Date.now(),
      mtime: Date.now(),
      size: content.length
    });
  } catch (error: unknown) {
    // File doesn't exist or can't be read - this is expected for most files
    // Only log if it's an unexpected error
    if (!(error instanceof Error) || !error.message.includes('ENOENT')) {
      const logMessage = `Unexpected error reading file ${filePath}: ${String(error)}`;
      if (logger) {
        logger(logMessage);
      } else {
        console.log(logMessage);
      }
    }
  }
};
