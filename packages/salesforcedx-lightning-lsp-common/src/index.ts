/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export {
  toResolvedPath,
  isLWCRootDirectoryCreated,
  relativePath,
  pathStartsWith,
  getExtension,
  getBasename,
  getSfdxResource,
  memoize,
  readJsonSync,
  writeJson,
  readPackageJson,
  extractJsonFromImport,
  normalizePath,
  nameFromFile,
  nameFromDirectory,
  componentFromFile,
  componentFromDirectory
} from './utils';
export type { SfdxTsConfig, TsConfigPaths, NormalizedPath } from './utils';

// Re-export from base-context
export { BaseWorkspaceContext, AURA_EXTENSIONS, getModulesDirs, updateForceIgnoreFile } from './baseContext';
export type { BaseWorkspaceContextOptions, Indexer } from './baseContext';

// Re-export from shared
export { isLWC, getSfdxProjectFile, detectWorkspaceHelper } from './shared';
export type { WorkspaceType } from './shared';

// Re-export from indexer
export { getHover } from './indexer/tagInfo';
export type { TagInfo } from './indexer/tagInfo';
export type { AttributeInfo, DecoratorType, MemberType } from './indexer/attributeInfo';

// Re-export from other modules
export { Logger } from './logger';
export { findLwcNamespaceRoots } from './namespaceUtils';

// Re-export from decorators
export type {
  ClassMember,
  Location,
  Position,
  ClassMemberPropertyValue,
  DecoratorTargetType,
  DecoratorTargetProperty,
  DecoratorTargetMethod
} from './decorators';

// WORKSPACE_READ_FILE_REQUEST is used by server and client. registerWorkspaceReadFileHandler is
// client-only (uses effect-ext-utils/vscode); export it from ./workspaceReadFileHandler so the
// server bundle never loads it (server runs in a separate process without vscode).
export {
  WORKSPACE_READ_FILE_REQUEST,
  WORKSPACE_STAT_REQUEST,
  WORKSPACE_READ_DIRECTORY_REQUEST,
  WORKSPACE_FIND_FILES_REQUEST,
  WORKSPACE_DELETE_FILE_REQUEST
} from './lspCustomRequests';

// Re-export from file system providers
export { LspFileSystemAccessor } from './providers/lspFileSystemAccessor';
export type { DirectoryEntry, FileStat, WorkspaceConfig } from './types/fileSystemTypes';
export { isPackageJson } from './types/packageJson';
export type { PackageJson } from './types/packageJson';

// Re-export TypeScript configuration templates
export { baseTsConfigJson, tsConfigTemplateJson } from './resources/sfdx/tsconfig';

/**
 * Custom LSP notification sent by the LWC server when delayed initialization
 * is complete and the server is ready to serve requests.
 */
export const LWC_SERVER_READY_NOTIFICATION = 'custom/lwcServerReady';

/**
 * Custom LSP notification sent by the Aura server when delayed initialization
 * is complete and the server is ready to serve requests.
 */
export const AURA_SERVER_READY_NOTIFICATION = 'custom/auraServerReady';
