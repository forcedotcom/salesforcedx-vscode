/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DirectoryEntry, FileStat } from './types/fileSystemTypes';
import type { URI } from 'vscode-uri';

/**
 * Wire shape for URI fields. URI instances JSON.stringify via URI.toJSON into UriComponents.
 * On receive, call URI.revive(params.uri) to rehydrate a URI instance.
 * vscode-uri does not re-export UriComponents from its package entry, so derive it from URI.toJSON.
 */
type UriComponents = ReturnType<URI['toJSON']>;
/**
 * Custom LSP request: client (extension) reads file via FsService and returns content.
 * Server sends this request when LspFileSystemAccessor is configured
 * with setConnection(connection); the accessor uses WORKSPACE_READ_FILE_REQUEST.
 *
 * URI fields travel as UriComponents on the wire (JSON.stringify invokes URI.toJSON()).
 * Receivers must call URI.revive(params.uri) to get a URI instance back.
 */
export const WORKSPACE_READ_FILE_REQUEST = 'workspace/readFile' as const;

export interface WorkspaceReadFileParams {
  /** File URI components (file:// or memfs://). Revive with URI.revive. */
  uri: UriComponents;
}

export interface WorkspaceReadFileResult {
  content?: string;
  error?: string;
}

/**
 * Custom LSP request: client returns file stat via FsService.stat.
 * Server sends this when LspFileSystemAccessor is configured
 * with setConnection(connection); the accessor uses WORKSPACE_STAT_REQUEST.
 */
export const WORKSPACE_STAT_REQUEST = 'workspace/stat' as const;

export interface WorkspaceStatParams {
  /** File or directory URI components (file:// or memfs://). Revive with URI.revive. */
  uri: UriComponents;
}

export interface WorkspaceStatResult {
  stat?: FileStat;
  error?: string;
}

/**
 * Custom LSP request: client returns directory listing via FsService.readDirectory.
 * Server sends this when LspFileSystemAccessor needs a listing and is configured
 * with setReadDirectoryFromConnection(connection, WORKSPACE_READ_DIRECTORY_REQUEST).
 */
export const WORKSPACE_READ_DIRECTORY_REQUEST = 'workspace/readDirectory' as const;

export interface WorkspaceReadDirectoryParams {
  /** Directory URI components (file:// or memfs://). Revive with URI.revive. */
  uri: UriComponents;
}

export interface WorkspaceReadDirectoryResult {
  entries?: DirectoryEntry[];
  error?: string;
}

/**
 * Custom LSP request: client returns file URIs matching a glob via vscode.workspace.findFiles.
 * Server sends this when the file system provider is configured with setConnection(connection);
 * so the server can discover files without relying on the stat cache (e.g. for LWC component indexing).
 */
export const WORKSPACE_FIND_FILES_REQUEST = 'workspace/findFiles' as const;

export interface WorkspaceFindFilesParams {
  /** Base folder URI (file:// or memfs://) to search under. */
  baseFolderUri: string;
  /** Glob pattern relative to base folder. */
  pattern: string;
}

export interface WorkspaceFindFilesResult {
  uris?: string[];
  error?: string;
}

/**
 * Custom LSP request: client deletes a file via FsService.deleteFile.
 */
export const WORKSPACE_DELETE_FILE_REQUEST = 'workspace/deleteFile' as const;

export interface WorkspaceDeleteFileParams {
  /** File URI to delete (file:// or memfs://). */
  uri: string;
}

export interface WorkspaceDeleteFileResult {
  error?: string;
}
