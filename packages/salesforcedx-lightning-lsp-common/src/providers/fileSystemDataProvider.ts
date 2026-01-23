/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { Connection, ApplyWorkspaceEditRequest, CreateFile, Position, TextDocumentEdit, TextEdit, WorkspaceEdit } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { Logger } from '../logger';
import { FileStat, DirectoryEntry, WorkspaceConfig } from '../types/fileSystemTypes';
import { NormalizedPath, normalizePath } from '../utils';

/**
 * Interface for file system operations
 */
export interface IFileSystemProvider {
  getFileContent(uri: string): string | undefined;
  getDirectoryListing(uri: NormalizedPath): DirectoryEntry[];
  getFileStat(uri: string): FileStat | undefined;
  fileExists(uri: string): boolean;
  directoryExists(uri: NormalizedPath): boolean;
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

  public async updateFileContent(uri: string, content: string, connection?: Connection): Promise<void> {
    const normalizedUri = normalizePath(uri);

    // If connection is available, use LSP workspace/applyEdit to create/write the file
    if (connection) {
      const fileUri = URI.file(normalizedUri).toString();

      const edit: WorkspaceEdit = {
        documentChanges: [
          CreateFile.create(fileUri, { overwrite: true }),
          TextDocumentEdit.create(
            { uri: fileUri, version: null },
            [TextEdit.insert(Position.create(0, 0), content)]
          )
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
          Logger.info(`[FileSystemProvider] Connection disposed while creating file ${normalizedUri} - server may be shutting down`);
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
   * Get file content
   */
  public getFileContent(uri: string): string | undefined {
    return this.fileContents.get(normalizePath(uri));
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
   * Get file stat
   */
  public getFileStat(uri: string): FileStat | undefined {
    return this.fileStats.get(normalizePath(uri));
  }

  /**
   * Check if file exists
   */
  public fileExists(uri: string): boolean {
    const stat = this.fileStats.get(normalizePath(uri));
    return stat?.exists ?? false;
  }

  /**
   * Check if directory exists
   * A directory exists if:
   * 1. It has a file stat with type 'directory', OR
   * 2. It has a directory listing (even if no explicit stat was created), OR
   * 3. Any files exist with paths that start with this directory path (inferred existence)
   */
  public directoryExists(uri: NormalizedPath): boolean {
    const stat = this.fileStats.get(uri);
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

    return Array.from(this.fileStats.keys()).some(fileUri => fileUri.startsWith(dirPathWithSlash));
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
   * Get all file URIs
   */
  public getAllFileUris(): NormalizedPath[] {
    const allKeys = Array.from(this.fileStats.keys());

    const existingFiles = allKeys.filter(uri => {
      const stat = this.getFileStat(uri);
      return stat?.exists ?? false;
    });

    return existingFiles;
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
