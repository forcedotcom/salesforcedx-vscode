/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import {
  Connection,
  ApplyWorkspaceEditRequest,
  CreateFile,
  Position,
  TextDocumentEdit,
  TextEdit,
  WorkspaceEdit,
  DocumentUri
} from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { Logger } from '../logger';
import {
  WORKSPACE_DELETE_FILE_REQUEST,
  WORKSPACE_READ_FILE_REQUEST,
  WORKSPACE_READ_DIRECTORY_REQUEST,
  WORKSPACE_STAT_REQUEST,
  WORKSPACE_FIND_FILES_REQUEST,
  type WorkspaceReadFileParams,
  type WorkspaceReadFileResult,
  type WorkspaceStatParams,
  type WorkspaceStatResult,
  type WorkspaceReadDirectoryParams,
  type WorkspaceReadDirectoryResult,
  type WorkspaceFindFilesParams,
  type WorkspaceFindFilesResult,
  type WorkspaceDeleteFileParams,
  type WorkspaceDeleteFileResult
} from '../lspCustomRequests';
import { FileStat, DirectoryEntry } from '../types/fileSystemTypes';
import { NormalizedPath, normalizePath } from '../utils';

// --- Standalone helpers (no instance state) ---

/** Empty directory listing; no workspace/readDirectory and no local cache. */
const getEmptyDirectoryListing = (_uri: NormalizedPath): DirectoryEntry[] => [];

/**
 * True when `s` is already a document URI (`scheme:…`), including `memfs:/MyProject/…` (no `//` authority).
 * Excludes Windows paths (`C:/…`) so they still go through path → URI conversion.
 */
const isDocumentUriString = (s: string): boolean =>
  /^[a-z][\w+.-]*:/i.test(s) && !/^[A-Za-z]:[/\\]/i.test(s);

/**
 * Convert a URI to a normalized file path.
 * Web uses memfs (single scheme); desktop uses file://. Pass the workspace folder URI when in web to align path extraction.
 */
const uriToNormalizedPath = (uri: DocumentUri, workspaceFolderUri?: string): NormalizedPath => {
  try {
    const parsedUri = URI.parse(uri);
    if (parsedUri.scheme === 'file') {
      return normalizePath(parsedUri.fsPath);
    }
    if (workspaceFolderUri) {
      const workspaceUri = URI.parse(workspaceFolderUri);
      if (workspaceUri.scheme === parsedUri.scheme) {
        const workspacePath = normalizePath(workspaceUri.fsPath || workspaceUri.path);
        const uriPath = parsedUri.path;
        if (parsedUri.path === workspaceUri.path) {
          return workspacePath.startsWith('/') ? normalizePath(workspacePath.substring(1)) : workspacePath;
        }
        if (uriPath.startsWith(workspaceUri.path)) {
          const relPathAfterWorkspace = uriPath.substring(workspaceUri.path.length);
          const cleanRelativePath = relPathAfterWorkspace.startsWith('/')
            ? relPathAfterWorkspace.substring(1)
            : relPathAfterWorkspace;
          const workspacePathNoSlash = workspacePath.startsWith('/') ? workspacePath.substring(1) : workspacePath;
          return cleanRelativePath
            ? normalizePath(path.join(workspacePathNoSlash, cleanRelativePath))
            : normalizePath(workspacePathNoSlash);
        }
      }
    }
    const filePath = parsedUri.path.startsWith('/') ? parsedUri.path.substring(1) : parsedUri.path;
    return normalizePath(filePath);
  } catch {
    return normalizePath(uri.replace(/^[^:]+:\/\//, ''));
  }
};

/**
 * Convert a normalized file path to a URI. Web uses memfs; desktop uses file://. Pass the workspace folder URI when in web.
 */
const getFileUriForPath = (filePath: NormalizedPath, workspaceFolderUri?: string): string => {
  if (workspaceFolderUri) {
    try {
      const workspaceUri = URI.parse(workspaceFolderUri);
      const workspacePath =
        workspaceUri.scheme === 'memfs'
          ? normalizePath(workspaceUri.path)
          : normalizePath(workspaceUri.fsPath || workspaceUri.path);
      const normalizedWorkspacePath =
        workspacePath.startsWith('/') && !workspacePath.startsWith('//') ? workspacePath.substring(1) : workspacePath;
      const normalizedFilePath =
        filePath.startsWith('/') && !filePath.startsWith('//') ? filePath.substring(1) : filePath;

      if (normalizedFilePath.startsWith(normalizedWorkspacePath) && workspaceUri.scheme === 'memfs') {
        const relativePath = normalizedFilePath.substring(normalizedWorkspacePath.length);
        const cleanRelativePath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
        const fullPath = cleanRelativePath ? `${workspaceUri.path}/${cleanRelativePath}` : workspaceUri.path;
        return URI.from({ scheme: workspaceUri.scheme, path: fullPath }).toString();
      }
    } catch (error) {
      Logger.error(`[getFileUriForPath] Error: ${error instanceof Error ? error.message : String(error)}`, error);
    }
  }
  try {
    return URI.file(filePath).toString();
  } catch (error) {
    Logger.error(
      `[getFileUriForPath] Error for path ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
    return `file://${filePath}`;
  }
};

/**
 * Accesses the file system via the LSP client (no local cache).
 * Reads use workspace/readFile, workspace/stat, workspace/findFiles when configured.
 */
export class LspFileSystemAccessor {
  private workspaceFolderUri?: string;
  private connection?: Connection;

  /** Set the LSP connection used for workspace/readFile, workspace/stat, and workspace/findFiles. */
  public setConnection(connection: Connection): void {
    this.connection = connection;
  }

  /** Set workspace folder URI(s). In practice web has one memfs root, desktop has file://; we use the first. */
  public setWorkspaceFolderUris(uris: string[]): void {
    this.workspaceFolderUri = uris[0];
  }

  public uriToNormalizedPath(uri: DocumentUri): NormalizedPath {
    return uriToNormalizedPath(uri, this.workspaceFolderUri);
  }

  public getFileUriForPath(filePath: NormalizedPath): string {
    return getFileUriForPath(filePath, this.workspaceFolderUri);
  }

  public async getDirectoryListing(uri: NormalizedPath): Promise<DirectoryEntry[]> {
    if (!this.connection) {
      return getEmptyDirectoryListing(uri);
    }
    try {
      const fileUri = getFileUriForPath(uri, this.workspaceFolderUri);
      const params: WorkspaceReadDirectoryParams = { uri: URI.parse(fileUri) };
      const result = await this.connection.sendRequest<WorkspaceReadDirectoryResult>(
        WORKSPACE_READ_DIRECTORY_REQUEST,
        params
      );
      if (result?.error) {
        Logger.error(`[LspFileSystemAccessor] workspace/readDirectory failed for ${uri}: ${result.error}`);
        return getEmptyDirectoryListing(uri);
      }
      return result?.entries ?? getEmptyDirectoryListing(uri);
    } catch (error) {
      Logger.error(
        `[LspFileSystemAccessor] getDirectoryListing error for ${uri}: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
      return getEmptyDirectoryListing(uri);
    }
  }

  public async updateFileContent(uri: string, content: string): Promise<void> {
    const normalizedUri = normalizePath(uri);
    if (this.connection) {
      const fileUri = getFileUriForPath(normalizedUri, this.workspaceFolderUri);
      const edit: WorkspaceEdit = {
        documentChanges: [
          CreateFile.create(fileUri, { overwrite: true }),
          TextDocumentEdit.create({ uri: fileUri, version: null }, [TextEdit.insert(Position.create(0, 0), content)])
        ]
      };
      try {
        const result = await this.connection.sendRequest(ApplyWorkspaceEditRequest.type, {
          label: `Create ${path.basename(normalizedUri)}`,
          edit
        });
        if (!result.applied) {
          throw new Error(`Failed to create file ${normalizedUri}: ${result.failureReason ?? 'Unknown error'}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('connection got disposed') && !errorMessage.includes('Pending response rejected')) {
          Logger.error(`[LspFileSystemAccessor] Failed to create file via LSP: ${normalizedUri}`, error);
          throw error;
        }
      }
    }
  }

  public async getFileContent(uri: string): Promise<string | undefined> {
    if (this.connection) {
      // If the caller already provides a full URI (e.g. file:///…, memfs:/MyProject/…), use it as-is.
      // Otherwise convert the filesystem path to the correct URI for the current workspace scheme.
      const fileUri = isDocumentUriString(uri) ? uri : getFileUriForPath(normalizePath(uri), this.workspaceFolderUri);
      const key = isDocumentUriString(uri) ? uri : normalizePath(uri);
      const params: WorkspaceReadFileParams = { uri: URI.parse(fileUri) };
      const result = await this.connection.sendRequest<WorkspaceReadFileResult>(WORKSPACE_READ_FILE_REQUEST, params);
      if (result.error) {
        Logger.error(`[LspFileSystemAccessor] workspace/readFile failed for ${key}: ${result.error}`);
        return undefined;
      }
      return result.content;
    }
    return undefined;
  }

  public async getFileStat(uri: string): Promise<FileStat | undefined> {
    if (!this.connection) {
      return undefined;
    }
    // Match getFileContent: callers pass full DocumentUris (file:///…, memfs:/MyProject/…). Do not run
    // getFileUriForPath + URI.file() on those — especially memfs, which uses a single slash after the scheme.
    const fileUri = isDocumentUriString(uri) ? uri : getFileUriForPath(normalizePath(uri), this.workspaceFolderUri);
    const params: WorkspaceStatParams = { uri: URI.parse(fileUri) };
    const result = await this.connection.sendRequest<WorkspaceStatResult>(WORKSPACE_STAT_REQUEST, params);
    if (result.error) {
      return undefined;
    }
    return result.stat;
  }

  public async fileExists(uri: string): Promise<boolean> {
    const stat = await this.getFileStat(uri);
    return stat?.exists ?? false;
  }

  public async findFilesWithGlobAsync(pattern: string, basePath: NormalizedPath): Promise<NormalizedPath[]> {
    if (!this.connection) return [];
    try {
      const baseFolderUri = getFileUriForPath(basePath, this.workspaceFolderUri);
      const params: WorkspaceFindFilesParams = { baseFolderUri, pattern };
      const findFilesRequestPromise = this.connection.sendRequest<WorkspaceFindFilesResult>(
        WORKSPACE_FIND_FILES_REQUEST,
        params
      );
      let findFilesTimeoutId: ReturnType<typeof setTimeout>;
      const findFilesTimeoutPromise = new Promise<WorkspaceFindFilesResult>((_, reject) => {
        findFilesTimeoutId = setTimeout(() => reject(new Error('workspace/findFiles timeout')), 8000); // 8 seconds
      });
      const result = await Promise.race([findFilesRequestPromise, findFilesTimeoutPromise]).finally(() =>
        clearTimeout(findFilesTimeoutId!)
      );
      if (result?.error || !result?.uris) {
        return [];
      }
      return result.uris.map(u => uriToNormalizedPath(u, this.workspaceFolderUri));
    } catch {
      return [];
    }
  }

  public async deleteFile(pathOrUri: string): Promise<void> {
    if (this.connection) {
      const key = normalizePath(pathOrUri);
      const fileUri = key.includes('://') ? key : getFileUriForPath(key, this.workspaceFolderUri);
      const deleteParams: WorkspaceDeleteFileParams = { uri: fileUri };
      const result = await this.connection.sendRequest<WorkspaceDeleteFileResult>(
        WORKSPACE_DELETE_FILE_REQUEST,
        deleteParams
      );
      if (result?.error) {
        Logger.error(`[LspFileSystemAccessor] workspace/deleteFile failed for ${fileUri}: ${result.error}`);
        throw new Error(result.error);
      }
    }
  }
}
