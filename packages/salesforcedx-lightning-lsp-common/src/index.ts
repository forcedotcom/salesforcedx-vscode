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
  SfdxTsConfig,
  TsConfigPaths,
  normalizePath,
  type NormalizedPath,
  nameFromFile,
  nameFromDirectory,
  componentFromFile,
  componentFromDirectory
} from './utils';

// Re-export from base-context
export {
  BaseWorkspaceContext,
  type BaseWorkspaceContextOptions,
  Indexer,
  AURA_EXTENSIONS,
  getModulesDirs,
  updateForceIgnoreFile
} from './baseContext';

// Re-export from shared
export { WorkspaceType, isLWC, getSfdxProjectFile, detectWorkspaceHelper } from './shared';

// Re-export from indexer
export { TagInfo, getHover } from './indexer/tagInfo';
export { AttributeInfo, DecoratorType, MemberType } from './indexer/attributeInfo';

// Re-export from other modules
export { Logger } from './logger';
export { findLwcNamespaceRoots } from './namespaceUtils';

// Re-export from decorators
export {
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
export { DirectoryEntry, FileStat, WorkspaceConfig } from './types/fileSystemTypes';
export { PackageJson, isPackageJson } from './types/packageJson';

// Re-export TypeScript configuration templates
export { baseTsConfigJson, tsConfigTemplateJson } from './resources/sfdx/tsconfig';
