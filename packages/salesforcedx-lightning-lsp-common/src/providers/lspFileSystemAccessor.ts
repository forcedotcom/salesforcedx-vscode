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
  type WorkspaceReadFileResult,
  type WorkspaceStatResult,
  type WorkspaceFindFilesParams,
  type WorkspaceFindFilesResult,
  type WorkspaceDeleteFileResult
} from '../lspCustomRequests';
import { FileStat, DirectoryEntry } from '../types/fileSystemTypes';
import { NormalizedPath, normalizePath } from '../utils';

// --- Standalone helpers (no instance state) ---

/** Empty directory listing; no workspace/readDirectory and no local cache. */
export const getEmptyDirectoryListing = (_uri: NormalizedPath): DirectoryEntry[] => [];

/**
 * Convert a URI to a normalized file path.
 * Web uses memfs (single scheme); desktop uses file://. Pass the workspace folder URI when in web to align path extraction.
 */
export const uriToNormalizedPath = (uri: DocumentUri, workspaceFolderUri?: string): NormalizedPath => {
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
    let filePath = parsedUri.path;
    if (filePath.startsWith('/')) {
      filePath = filePath.substring(1);
    }
    return normalizePath(filePath);
  } catch {
    return normalizePath(uri.replace(/^[^:]+:\/\//, ''));
  }
};

/**
 * Convert a normalized file path to a URI. Web uses memfs; desktop uses file://. Pass the workspace folder URI when in web.
 */
export const getFileUriForPath = (filePath: NormalizedPath, workspaceFolderUri?: string): string => {
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

const FIND_FILES_TIMEOUT_MS = 8000;
const FIND_FILES_LOG_FIRST_N = 8;

/**
 * Accesses the file system via the LSP client (no local cache).
 * Reads use workspace/readFile, workspace/stat, workspace/findFiles when configured.
 */
export class LspFileSystemAccessor {
  private workspaceFolderUri?: string;
  private connectionForRead?: Connection;
  private readFileRequestMethod?: string;
  private connectionForStat?: Connection;
  private statRequestMethod?: string;
  private connectionForFindFiles?: Connection;
  private findFilesRequestMethod?: string;
  private findFilesLogCount = 0;

  public setFindFilesFromConnection(connection: Connection, requestMethod: string): void {
    this.connectionForFindFiles = connection;
    this.findFilesRequestMethod = requestMethod;
  }

  public setReadFileFromConnection(connection: Connection, requestMethod: string): void {
    this.connectionForRead = connection;
    this.readFileRequestMethod = requestMethod;
  }

  public setReadStatFromConnection(connection: Connection, requestMethod: string): void {
    this.connectionForStat = connection;
    this.statRequestMethod = requestMethod;
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

  public getDirectoryListing(uri: NormalizedPath): DirectoryEntry[] {
    return getEmptyDirectoryListing(uri);
  }

  public async updateFileContent(uri: string, content: string, connection?: Connection): Promise<void> {
    const normalizedUri = normalizePath(uri);
    if (connection) {
      const fileUri = getFileUriForPath(normalizedUri, this.workspaceFolderUri);
      const edit: WorkspaceEdit = {
        documentChanges: [
          CreateFile.create(fileUri, { overwrite: true }),
          TextDocumentEdit.create({ uri: fileUri, version: null }, [TextEdit.insert(Position.create(0, 0), content)])
        ]
      };
      try {
        const result = await connection.sendRequest(ApplyWorkspaceEditRequest.type, {
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
    const key = normalizePath(uri);
    if (this.connectionForRead && this.readFileRequestMethod) {
      const fileUri = getFileUriForPath(key, this.workspaceFolderUri);
      const result = await this.connectionForRead.sendRequest<WorkspaceReadFileResult>(this.readFileRequestMethod, {
        uri: fileUri
      });
      if (result.error) {
        Logger.error(`[LspFileSystemAccessor] workspace/readFile failed for ${key}: ${result.error}`);
        return undefined;
      }
      return result.content;
    }
    return undefined;
  }

  public async getFileStat(uri: string): Promise<FileStat | undefined> {
    const key = normalizePath(uri);
    if (this.connectionForStat && this.statRequestMethod) {
      const fileUri = getFileUriForPath(key, this.workspaceFolderUri);
      const result = await this.connectionForStat.sendRequest<WorkspaceStatResult>(this.statRequestMethod, {
        uri: fileUri
      });
      if (result.error) return undefined;
      return result.stat;
    }
    return undefined;
  }

  public async fileExists(uri: string): Promise<boolean> {
    const stat = await this.getFileStat(uri);
    return stat?.exists ?? false;
  }

  public async directoryExists(uri: NormalizedPath): Promise<boolean> {
    const stat = await this.getFileStat(uri);
    return (stat?.exists && stat.type === 'directory') ?? false;
  }

  public async findFilesWithGlobAsync(
    pattern: string,
    basePath: NormalizedPath
  ): Promise<NormalizedPath[] | undefined> {
    if (!this.connectionForFindFiles || !this.findFilesRequestMethod) return undefined;
    const logThis = ++this.findFilesLogCount <= FIND_FILES_LOG_FIRST_N;
    try {
      const baseFolderUri = getFileUriForPath(basePath, this.workspaceFolderUri);
      const params: WorkspaceFindFilesParams = { baseFolderUri, pattern };
      if (logThis) {
        Logger.info(`[findFilesWithGlobAsync] basePath=${basePath} baseFolderUri=${baseFolderUri} pattern=${pattern}`);
      }
      const result = await Promise.race([
        this.connectionForFindFiles.sendRequest<WorkspaceFindFilesResult>(this.findFilesRequestMethod, params),
        new Promise<WorkspaceFindFilesResult>((_, reject) =>
          setTimeout(() => reject(new Error('workspace/findFiles timeout')), FIND_FILES_TIMEOUT_MS)
        )
      ]);
      if (result?.error || !result?.uris) {
        if (logThis) Logger.info(`[findFilesWithGlobAsync] error or empty: ${result?.error ?? 'none'}`);
        return undefined;
      }
      if (logThis) Logger.info(`[findFilesWithGlobAsync] ${result.uris.length} uris for pattern=${pattern}`);
      if (this.findFilesLogCount === FIND_FILES_LOG_FIRST_N + 1) {
        Logger.info('[findFilesWithGlobAsync] further requests not logged');
      }
      return result.uris.map(u => uriToNormalizedPath(u, this.workspaceFolderUri));
    } catch (err) {
      if (logThis) Logger.info(`[findFilesWithGlobAsync] failed: ${err instanceof Error ? err.message : String(err)}`);
      return undefined;
    }
  }

  public async deleteFile(pathOrUri: string, connection?: Connection): Promise<void> {
    if (!connection) return;
    const key = normalizePath(pathOrUri);
    const fileUri = key.includes('://') ? key : getFileUriForPath(key, this.workspaceFolderUri);
    const result = await connection.sendRequest<WorkspaceDeleteFileResult>(WORKSPACE_DELETE_FILE_REQUEST, {
      uri: fileUri
    });
    if (result?.error) {
      Logger.error(`[LspFileSystemAccessor] workspace/deleteFile failed for ${fileUri}: ${result.error}`);
      throw new Error(result.error);
    }
  }
}
