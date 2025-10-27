/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * File system data types for LSP communication
 * These types represent file system operations that the client will perform
 * and send data to the language server instead of the server accessing files directly
 */

export interface FileSystemData {
    /** File contents keyed by URI */
    fileContents: Map<string, string>;
    /** Directory listings keyed by URI */
    directoryListings: Map<string, DirectoryEntry[]>;
    /** File stats keyed by URI */
    fileStats: Map<string, FileStat>;
    /** Workspace configuration data */
    workspaceConfig: WorkspaceConfig;
}

export interface DirectoryEntry {
    name: string;
    type: 'file' | 'directory';
    uri: string;
}

export interface FileStat {
    type: 'file' | 'directory';
    ctime: number;
    mtime: number;
    size: number;
    exists: boolean;
}

export interface WorkspaceConfig {
    /** Workspace root URI */
    rootUri: string;
    /** Workspace type (SFDX, CORE_ALL, etc.) */
    workspaceType: string;
    /** Package directories for SFDX projects */
    packageDirectories?: string[];
    /** TypeScript configuration */
    tsConfig?: any;
    /** JavaScript configuration */
    jsConfig?: any;
    /** Force ignore patterns */
    forceIgnore?: string[];
}

/**
 * LSP notification types for file system operations
 */
export namespace FileSystemNotifications {
    export const FILE_CONTENT_CHANGED = 'lwc/fileContentChanged';
    export const DIRECTORY_CHANGED = 'lwc/directoryChanged';
    export const WORKSPACE_CONFIG_CHANGED = 'lwc/workspaceConfigChanged';
    export const TYPING_FILES_REQUEST = 'lwc/typingFilesRequest';
    export const COMPONENT_FILES_REQUEST = 'lwc/componentFilesRequest';
}

/**
 * LSP request types for file system operations
 */
export namespace FileSystemRequests {
    export const GET_FILE_CONTENT = 'lwc/getFileContent';
    export const GET_DIRECTORY_LISTING = 'lwc/getDirectoryListing';
    export const GET_FILE_STAT = 'lwc/getFileStat';
    export const CREATE_TYPING_FILES = 'lwc/createTypingFiles';
    export const DELETE_TYPING_FILES = 'lwc/deleteTypingFiles';
    export const UPDATE_COMPONENT_INDEX = 'lwc/updateComponentIndex';
}

/**
 * Request/Response types for LSP communication
 */
export interface FileContentRequest {
    uri: string;
}

export interface FileContentResponse {
    content: string;
    exists: boolean;
}

export interface DirectoryListingRequest {
    uri: string;
}

export interface DirectoryListingResponse {
    entries: DirectoryEntry[];
    exists: boolean;
}

export interface FileStatRequest {
    uri: string;
}

export interface FileStatResponse {
    stat: FileStat;
}

export interface TypingFilesRequest {
    files: TypingFileOperation[];
}

export interface TypingFileOperation {
    type: 'create' | 'delete' | 'update';
    uri: string;
    content?: string;
}

export interface ComponentIndexRequest {
    components: ComponentIndexData[];
}

export interface ComponentIndexData {
    uri: string;
    content: string;
    mtime: number;
    type: 'lwc' | 'aura';
}
