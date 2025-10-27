/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FileStat, DirectoryEntry, WorkspaceConfig } from '../types/fileSystemTypes';

/**
 * Interface for file system operations
 */
export interface IFileSystemProvider {
    getFileContent(uri: string): string | undefined;
    getDirectoryListing(uri: string): DirectoryEntry[] | undefined;
    getFileStat(uri: string): FileStat | undefined;
    fileExists(uri: string): boolean;
    directoryExists(uri: string): boolean;
    updateFileContent(uri: string, content: string): void;
    updateDirectoryListing(uri: string, entries: DirectoryEntry[]): void;
    updateFileStat(uri: string, stat: FileStat): void;
    updateWorkspaceConfig(config: WorkspaceConfig): void;
}

/**
 * Manages file system data received from the LSP client
 * This replaces direct file system access in the language server
 */
export class FileSystemDataProvider implements IFileSystemProvider {
    private fileContents: Map<string, string> = new Map();
    private directoryListings: Map<string, DirectoryEntry[]> = new Map();
    private fileStats: Map<string, FileStat> = new Map();
    private workspaceConfig: WorkspaceConfig | null = null;

    /**
     * Update file content from client
     */
    public updateFileContent(uri: string, content: string): void {
        this.fileContents.set(uri, content);
    }

    /**
     * Get file content
     */
    public getFileContent(uri: string): string | undefined {
        return this.fileContents.get(uri);
    }

    /**
     * Check if file exists and has content
     */
    public hasFileContent(uri: string): boolean {
        return this.fileContents.has(uri);
    }

    /**
     * Update directory listing from client
     */
    public updateDirectoryListing(uri: string, entries: DirectoryEntry[]): void {
        this.directoryListings.set(uri, entries);
    }

    /**
     * Get directory listing
     */
    public getDirectoryListing(uri: string): DirectoryEntry[] | undefined {
        return this.directoryListings.get(uri);
    }

    /**
     * Update file stat from client
     */
    public updateFileStat(uri: string, stat: FileStat): void {
        this.fileStats.set(uri, stat);
    }

    /**
     * Get file stat
     */
    public getFileStat(uri: string): FileStat | undefined {
        return this.fileStats.get(uri);
    }

    /**
     * Check if file exists
     */
    public fileExists(uri: string): boolean {
        const stat = this.fileStats.get(uri);
        return stat?.exists ?? false;
    }

    /**
     * Check if directory exists
     */
    public directoryExists(uri: string): boolean {
        const stat = this.fileStats.get(uri);
        return (stat?.exists && stat.type === 'directory') ?? false;
    }

    /**
     * Update workspace configuration
     */
    public updateWorkspaceConfig(config: WorkspaceConfig): void {
        this.workspaceConfig = config;
    }

    /**
     * Get workspace configuration
     */
    public getWorkspaceConfig(): WorkspaceConfig | null {
        return this.workspaceConfig;
    }

    /**
     * Clear all data (useful for workspace changes)
     */
    public clear(): void {
        this.fileContents.clear();
        this.directoryListings.clear();
        this.fileStats.clear();
        this.workspaceConfig = null;
    }

    /**
     * Get all file URIs that have content
     */
    public getAllFileUris(): string[] {
        return Array.from(this.fileContents.keys());
    }

    /**
     * Get all directory URIs that have listings
     */
    public getAllDirectoryUris(): string[] {
        return Array.from(this.directoryListings.keys());
    }

    /**
     * Find files matching a pattern in directory listings
     */
    public findFilesInDirectory(dirUri: string, pattern: RegExp): string[] {
        const entries = this.getDirectoryListing(dirUri);
        if (!entries) return [];

        const files: string[] = [];
        for (const entry of entries) {
            if (entry.type === 'file' && pattern.test(entry.name)) {
                files.push(entry.uri);
            }
        }
        return files;
    }

    /**
     * Get file content as Uint8Array (for compatibility with existing code)
     */
    public getFileContentAsUint8Array(uri: string): Uint8Array | undefined {
        const content = this.getFileContent(uri);
        if (!content) return undefined;
        return new TextEncoder().encode(content);
    }

    /**
     * Get file content as Buffer (for compatibility with existing code)
     */
    public getFileContentAsBuffer(uri: string): Buffer | undefined {
        const content = this.getFileContent(uri);
        if (!content) return undefined;
        return Buffer.from(content, 'utf8');
    }
}
