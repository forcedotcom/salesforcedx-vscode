/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { WorkspaceReadFileResult, WorkspaceStatResult } from '../lspCustomRequests';
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
import { FileStat, DirectoryEntry, WorkspaceConfig } from '../types/fileSystemTypes';
import { NormalizedPath, normalizePath } from '../utils';

/**
 * Interface for file system operations
 */
export interface IFileSystemProvider {
  /** Returns from cache, or via workspace/readFile from client on cache miss when configured with setReadFileFromConnection. */
  getFileContent(uri: string): Promise<string | undefined>;
  getDirectoryListing(uri: NormalizedPath): DirectoryEntry[];
  /** Returns from cache, or via workspace/stat from client on cache miss when configured with setReadStatFromConnection. */
  getFileStat(uri: string): Promise<FileStat | undefined>;
  fileExists(uri: string): Promise<boolean>;
  directoryExists(uri: NormalizedPath): Promise<boolean>;
  /**
   * Update file content from client
   * If connection is provided, uses LSP workspace/applyEdit to create/write the file (works in both Node.js and web)
   * Otherwise, only updates the in-memory file system provider
   *
   * Promise resolves immediately if connection is not provided
   */
  updateFileContent(uri: string, content: string, connection?: Connection): Promise<void>;
  updateDirectoryListing(uri: string, entries: DirectoryEntry[]): void;
  updateFileStat(uri: string, stat: FileStat): void;
  updateWorkspaceConfig(config: WorkspaceConfig): void;
  getAllFileUris(): NormalizedPath[];
  /**
   * Convert a URI to a normalized file path
   * Handles both file:// and memfs:// (or other) schemes based on workspace folder URIs
   */
  uriToNormalizedPath(uri: DocumentUri): NormalizedPath;
  /**
   * Convert a normalized file path to a URI with the correct scheme (memfs:// or file://)
   * Preserves the workspace folder's URI scheme for web compatibility
   */
  getFileUriForPath(filePath: NormalizedPath): string;
}

/**
 * Manages file system data received from the LSP client
 * This replaces direct file system access in the language server
 */
export class FileSystemDataProvider implements IFileSystemProvider {
  private fileContents: Map<NormalizedPath, string> = new Map();
  private directoryListings: Map<NormalizedPath, DirectoryEntry[]> = new Map();
  private fileStats: Map<NormalizedPath, FileStat> = new Map();
  private workspaceConfig: WorkspaceConfig | null = null;
  private workspaceFolderUris: string[] = [];
  private connectionForRead?: Connection;
  private readFileRequestMethod?: string;
  private connectionForStat?: Connection;
  private statRequestMethod?: string;

  /**
   * When set, getFileContent uses workspace/readFile on cache miss so the client (e.g. FsService) can read the file.
   */
  public setReadFileFromConnection(connection: Connection, requestMethod: string): void {
    this.connectionForRead = connection;
    this.readFileRequestMethod = requestMethod;
  }

  /**
   * When set, getFileStat uses workspace/stat on cache miss so the client (e.g. FsService) can stat the file/directory.
   */
  public setReadStatFromConnection(connection: Connection, requestMethod: string): void {
    this.connectionForStat = connection;
    this.statRequestMethod = requestMethod;
  }

  /**
   * Set workspace folder URIs to use correct scheme when creating files
   * In web mode with memfs://, we need to use the workspace folder's scheme instead of file://
   *
   * Takes an array because VS Code supports multi-root workspaces with multiple workspace folders.
   * Each folder can have a different URI scheme (e.g., one file:// project and one memfs:// project).
   * When creating a file, we need to find which workspace folder contains the file path and use that folder's scheme.
   */
  public setWorkspaceFolderUris(uris: string[]): void {
    this.workspaceFolderUris = uris;
  }

  /**
   * Convert a URI to a normalized file path
   * Handles both file:// and memfs:// (or other) schemes based on workspace folder URIs
   */
  public uriToNormalizedPath(uri: DocumentUri): NormalizedPath {
    try {
      const parsedUri = URI.parse(uri);

      // For file:// URIs, use fsPath which handles Windows paths correctly (no leading slash)
      if (parsedUri.scheme === 'file') {
        return normalizePath(parsedUri.fsPath);
      }

      // For other schemes (memfs://, etc.), check if we can match it to a workspace folder
      // to determine the correct path extraction
      for (const workspaceFolderUri of this.workspaceFolderUris) {
        const workspaceUri = URI.parse(workspaceFolderUri);
        if (workspaceUri.scheme === parsedUri.scheme) {
          const workspacePath = normalizePath(workspaceUri.fsPath || workspaceUri.path);
          const uriPath = parsedUri.path;

          // If this is exactly the workspace folder URI, return the workspace path without leading slash
          if (parsedUri.path === workspaceUri.path) {
            // Remove leading slash for non-file schemes to get a relative path
            return workspacePath.startsWith('/') ? normalizePath(workspacePath.substring(1)) : workspacePath;
          }

          // Check if the URI path starts with the workspace path
          // For memfs:///MyProject/sfdx-project.json, uriPath is "/MyProject/sfdx-project.json"
          // and workspacePath is "/MyProject", so we extract the relative part
          if (uriPath.startsWith(workspaceUri.path)) {
            // Extract the relative path after the workspace path
            const relPathAfterWorkspace = uriPath.substring(workspaceUri.path.length);
            // Remove leading slash if present
            const cleanRelativePath = relPathAfterWorkspace.startsWith('/')
              ? relPathAfterWorkspace.substring(1)
              : relPathAfterWorkspace;
            // Join workspace path (without leading slash) with relative path
            const workspacePathNoSlash = workspacePath.startsWith('/') ? workspacePath.substring(1) : workspacePath;
            return cleanRelativePath
              ? normalizePath(path.join(workspacePathNoSlash, cleanRelativePath))
              : normalizePath(workspacePathNoSlash);
          }

          // Fallback: remove leading slash and use as-is
          const relativePath = uriPath.startsWith('/') ? uriPath.substring(1) : uriPath;
          return normalizePath(relativePath);
        }
      }

      // Fallback: extract path from URI and remove leading slash for non-file schemes
      let filePath = parsedUri.path;
      if (filePath.startsWith('/')) {
        filePath = filePath.substring(1);
      }
      return normalizePath(filePath);
    } catch {
      // Fallback: if URI parsing fails, try string replacement
      const filePath = uri.replace(/^[^:]+:\/\//, '');
      return normalizePath(filePath);
    }
  }

  /**
   * Get the appropriate URI for a file path based on workspace folder schemes i.e. memfs:// or file://
   * If the path is within a workspace folder, use that folder's scheme
   * Convert a normalized file path to a URI with the correct scheme (memfs:// or file://)
   * Preserves the workspace folder's URI scheme for web compatibility
   */
  public getFileUriForPath(filePath: NormalizedPath): string {
    // Check if the file path is within any workspace folder
    for (const workspaceFolderUri of this.workspaceFolderUris) {
      try {
        const workspaceUri = URI.parse(workspaceFolderUri);

        // For memfs:// URIs, use path property; for file:// URIs, use fsPath
        const workspacePath =
          workspaceUri.scheme === 'memfs'
            ? normalizePath(workspaceUri.path)
            : normalizePath(workspaceUri.fsPath || workspaceUri.path);

        // Remove leading slash from workspacePath for comparison (if present)
        const normalizedWorkspacePath =
          workspacePath.startsWith('/') && !workspacePath.startsWith('//') ? workspacePath.substring(1) : workspacePath;
        const normalizedFilePath =
          filePath.startsWith('/') && !filePath.startsWith('//') ? filePath.substring(1) : filePath;

        // Check if file path starts with workspace path
        if (normalizedFilePath.startsWith(normalizedWorkspacePath)) {
          // Use the workspace folder's scheme i.e. memfs:// or file://
          if (workspaceUri.scheme === 'memfs') {
            // For memfs:// URIs, construct the URI by joining with the workspace folder URI
            // Calculate relative path from workspace to file
            const relativePath = normalizedFilePath.substring(normalizedWorkspacePath.length);
            // Remove leading slash from relative path if present
            const cleanRelativePath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
            // Construct URI by joining workspace folder URI with relative path
            // workspaceUri.path is like "/MyProject", so we append "/force-app/..." to get "/MyProject/force-app/..."
            const fullPath = cleanRelativePath ? `${workspaceUri.path}/${cleanRelativePath}` : workspaceUri.path;

            try {
              const result = URI.from({
                scheme: workspaceUri.scheme,
                path: fullPath
              }).toString();
              return result;
            } catch (error) {
              Logger.error(
                `[getFileUriForPath] Error creating memfs URI: ${error instanceof Error ? error.message : String(error)}`,
                error
              );
              Logger.error(`[getFileUriForPath] scheme: ${workspaceUri.scheme}, path: ${fullPath}`);
              // Continue to try other workspace folders or fallback
            }
          }
        }
      } catch (error) {
        Logger.error(
          `[getFileUriForPath] Error processing workspaceFolderUri ${workspaceFolderUri}: ${error instanceof Error ? error.message : String(error)}`,
          error
        );
        continue;
      }
    }

    // Default to file:// if not in any workspace folder
    try {
      const result = URI.file(filePath).toString();
      return result;
    } catch (error) {
      Logger.error(
        `[getFileUriForPath] Error creating default file:// URI for path ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
      // Last resort fallback
      const fallback = `file://${filePath}`;
      Logger.warn(`[getFileUriForPath] Using fallback URI: ${fallback}`);
      return fallback;
    }
  }

  public async updateFileContent(uri: string, content: string, connection?: Connection): Promise<void> {
    const normalizedUri = normalizePath(uri);

    // If connection is available, use LSP workspace/applyEdit to create/write the file
    if (connection) {
      const fileUri = this.getFileUriForPath(normalizedUri);

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
          const errorMsg = result.failureReason ?? 'Unknown error';
          throw new Error(`Failed to create file ${normalizedUri}: ${errorMsg}`);
        }
      } catch (error) {
        // Handle connection disposal errors gracefully (server might be shutting down)
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('connection got disposed') || errorMessage.includes('Pending response rejected')) {
          // Don't throw - this is expected during shutdown, but still update in-memory provider
        } else {
          Logger.error(`[FileSystemProvider] Failed to create file via LSP: ${normalizedUri}`, error);
          throw error;
        }
      }
    }

    // Always update the in-memory file system provider for consistency
    this.fileContents.set(normalizedUri, content);
  }

  /**
   * Get file content: from cache first, then via workspace/readFile from client on cache miss when setReadFileFromConnection was called.
   */
  public async getFileContent(uri: string): Promise<string | undefined> {
    const key = normalizePath(uri);
    const cached = this.fileContents.get(key);
    if (cached !== undefined) {
      return cached;
    }
    if (this.connectionForRead && this.readFileRequestMethod) {
      try {
        const fileUri = this.getFileUriForPath(key);
        const result = await this.connectionForRead.sendRequest<WorkspaceReadFileResult>(this.readFileRequestMethod, {
          uri: fileUri
        });

        if (result.error) {
          Logger.error(`[FileSystemDataProvider] workspace/readFile failed for ${key}: ${result.error}`);
          return undefined;
        }
        if (result.content !== undefined) {
          this.fileContents.set(key, result.content);
        }
        return result.content;
      } catch (e) {
        Logger.error(
          `[FileSystemDataProvider] workspace/readFile failed for ${key}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
    return undefined;
  }

  /**
   * Update directory listing from client
   */
  public updateDirectoryListing(uri: string, entries: DirectoryEntry[]): void {
    // Normalize URIs in directory entries as well
    const normalizedEntries = entries.map(entry => ({
      ...entry,
      uri: normalizePath(entry.uri)
    }));
    this.directoryListings.set(normalizePath(uri), normalizedEntries);
  }

  /**
   * Get directory listing
   * If no explicit listing exists but the directory exists (inferred from files),
   * build a listing from files that are direct children of this directory.
   */
  public getDirectoryListing(uri: NormalizedPath): DirectoryEntry[] {
    const explicitListing = this.directoryListings.get(uri);
    // Only use explicit listing if it has entries - empty arrays should fall back to building from file stats
    if (explicitListing && explicitListing.length > 0) {
      return explicitListing;
    }

    const entries: DirectoryEntry[] = [];
    const seenNames = new Set<string>();

    // If no explicit listing (or explicit listing is empty), but directory exists (inferred from files/directories), build listing
    // Check directory existence by looking at file stats directly, not through directoryExists which might
    // return true for empty explicit listings
    const dirPathWithSlash = uri.endsWith('/') ? uri : `${uri}/`;

    // First, find all files that are direct children of this directory
    for (const fileUri of this.fileStats.keys()) {
      if (fileUri.startsWith(dirPathWithSlash)) {
        // Get the relative path from the directory
        const relativePath = fileUri.substring(dirPathWithSlash.length);
        // Only include immediate children (not nested files)
        if (relativePath && !relativePath.includes('/')) {
          const fileName = relativePath;
          if (!seenNames.has(fileName)) {
            seenNames.add(fileName);
            const stat = this.fileStats.get(fileUri);
            entries.push({
              name: fileName,
              type: stat?.type ?? 'file',
              uri: fileUri
            });
          }
        }
      }
    }

    // Also include directories that are direct children (needed for getModulesDirs in CORE_ALL)
    for (const [dirUri, stat] of this.fileStats.entries()) {
      if (stat.type === 'directory' && dirUri.startsWith(dirPathWithSlash) && dirUri !== uri) {
        const relativePath = dirUri.substring(dirPathWithSlash.length);
        // Only include immediate children (not nested directories)
        if (relativePath && !relativePath.includes('/')) {
          const dirName = relativePath;
          if (!seenNames.has(dirName)) {
            seenNames.add(dirName);
            entries.push({
              name: dirName,
              type: 'directory',
              uri: dirUri
            });
          }
        }
      }
    }

    return entries;
  }

  /**
   * Update file stat from client
   */
  public updateFileStat(uri: string, stat: FileStat): void {
    this.fileStats.set(normalizePath(uri), stat);
  }

  /**
   * Get file stat: from cache first, then via workspace/stat from client on cache miss when setReadStatFromConnection was called.
   */
  public async getFileStat(uri: string): Promise<FileStat | undefined> {
    const key = normalizePath(uri);

    if (this.connectionForStat && this.statRequestMethod) {
      try {
        const fileUri = this.getFileUriForPath(key);
        const result = await this.connectionForStat.sendRequest<WorkspaceStatResult>(this.statRequestMethod, {
          uri: fileUri
        });
        if (result.error) {
          return undefined;
        }
        if (result.stat !== undefined) {
          this.fileStats.set(key, result.stat);
          return result.stat;
        }
      } catch (e) {
        const cached = this.fileStats.get(key);
        if (cached !== undefined) {
          return cached;
        }
        Logger.warn(
          `[FileSystemDataProvider] workspace/stat failed for ${key}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
    // When no connection or request didn't return a stat, use local cache (e.g. tests with pre-populated provider)
    return this.fileStats.get(key);
  }

  /**
   * Check if file or directory exists. Uses cache first, then workspace/stat from client on miss when setReadStatFromConnection was called.
   */
  public async fileExists(uri: string): Promise<boolean> {
    const stat = await this.getFileStat(uri);
    return stat?.exists ?? false;
  }

  /**
   * Check if directory exists. Uses getFileStat (cache + workspace/stat) first, then directory listings and inferred paths.
   * A directory exists if:
   * 1. getFileStat returns a stat with type 'directory', OR
   * 2. It has a directory listing (even if no explicit stat was created), OR
   * 3. Any files exist with paths that start with this directory path (inferred existence)
   * - Checks both fileStats (files with stats) and fileContents (files with content)
   */
  public async directoryExists(uri: NormalizedPath): Promise<boolean> {
    const stat = await this.getFileStat(uri);
    if (stat?.exists && stat.type === 'directory') {
      return true;
    }

    // Check if there's a directory listing (directory might exist without explicit stat)
    if (this.directoryListings.has(uri)) {
      return true;
    }

    // Infer directory existence from files: if any file path starts with this directory path,
    // the directory must exist. Ensure we check with a trailing slash to avoid partial matches.
    const dirPathWithSlash = uri.endsWith('/') ? uri : `${uri}/`;

    // Check both fileStats and fileContents to catch files that are loaded but don't have stats yet
    return (
      Array.from(this.fileStats.keys()).some(fileUri => fileUri.startsWith(dirPathWithSlash)) ||
      Array.from(this.fileContents.keys()).some(fileUri => fileUri.startsWith(dirPathWithSlash))
    );
  }

  /**
   * Update workspace configuration
   */
  public updateWorkspaceConfig(config: WorkspaceConfig): void {
    this.workspaceConfig = config;
  }

  /**
   * Clear all data (useful for workspace changes)
   * visible for testing
   */
  public clear(): void {
    this.fileContents.clear();
    this.directoryListings.clear();
    this.fileStats.clear();
    this.workspaceConfig = null;
  }

  /**
   * Get all directory URIs that have listings
   */
  public getAllDirectoryUris(): NormalizedPath[] {
    // Keys are already normalized since we normalize on set
    return Array.from(this.directoryListings.keys());
  }

  /**
   * Get all file URIs (from cache only; does not trigger client requests).
   */
  public getAllFileUris(): NormalizedPath[] {
    const allKeys = Array.from(this.fileStats.keys());
    return allKeys.filter(uri => {
      const stat = this.fileStats.get(uri);
      return stat?.exists ?? false;
    });
  }

  /**
   * Serialize the provider data for transmission to the language server
   */
  public serialize(): {
    fileContents: Record<string, string>;
    directoryListings: Record<string, DirectoryEntry[]>;
    fileStats: Record<string, FileStat>;
    workspaceConfig: WorkspaceConfig | null;
  } {
    return {
      fileContents: Object.fromEntries(this.fileContents),
      directoryListings: Object.fromEntries(this.directoryListings),
      fileStats: Object.fromEntries(this.fileStats),
      workspaceConfig: this.workspaceConfig
    };
  }
}
