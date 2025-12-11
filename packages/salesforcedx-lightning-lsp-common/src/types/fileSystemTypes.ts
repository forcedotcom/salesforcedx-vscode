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
