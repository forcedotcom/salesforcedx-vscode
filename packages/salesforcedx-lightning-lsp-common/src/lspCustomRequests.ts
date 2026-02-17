/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DirectoryEntry, FileStat } from './types/fileSystemTypes';

/**
 * Custom LSP request: client (extension) reads file via FsService and returns content.
 * Server sends this request when FileSystemDataProvider has a cache miss and is configured
 * with setReadFileFromConnection(connection, WORKSPACE_READ_FILE_REQUEST).
 */
export const WORKSPACE_READ_FILE_REQUEST = 'workspace/readFile' as const;

export interface WorkspaceReadFileParams {
  /** File URI to read (file:// or memfs://). */
  uri: string;
}

export interface WorkspaceReadFileResult {
  content?: string;
  error?: string;
}

/**
 * Custom LSP request: client returns file stat via FsService.stat.
 * Server sends this when FileSystemDataProvider has a stat cache miss and is configured
 * with setReadStatFromConnection(connection, WORKSPACE_STAT_REQUEST).
 */
export const WORKSPACE_STAT_REQUEST = 'workspace/stat' as const;

export interface WorkspaceStatParams {
  /** File or directory URI (file:// or memfs://). */
  uri: string;
}

export interface WorkspaceStatResult {
  stat?: FileStat;
  error?: string;
}

/**
 * Custom LSP request: client returns directory listing via FsService.readDirectory.
 * Server sends this when FileSystemDataProvider needs a listing on cache miss and is configured
 * with setReadDirectoryFromConnection(connection, WORKSPACE_READ_DIRECTORY_REQUEST).
 */
export const WORKSPACE_READ_DIRECTORY_REQUEST = 'workspace/readDirectory' as const;

export interface WorkspaceReadDirectoryParams {
  /** Directory URI (file:// or memfs://). */
  uri: string;
}

export interface WorkspaceReadDirectoryResult {
  entries?: DirectoryEntry[];
  error?: string;
}
