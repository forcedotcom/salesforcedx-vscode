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
  writeJsonSync,
  extractJsonFromImport,
  SfdxTsConfig,
  TsConfigPaths,
  unixify
} from './utils';

// Re-export from base-context
export {
  BaseWorkspaceContext,
  Indexer,
  AURA_EXTENSIONS,
  processTemplate,
  getModulesDirs,
  updateForceIgnoreFile
} from './baseContext';

// Re-export from shared
export { WorkspaceType, isLWC, getSfdxProjectFile, detectWorkspaceHelper, detectWorkspaceType } from './shared';

// Re-export from indexer
export { TagInfo, getHover } from './indexer/tagInfo';
export { AttributeInfo, DecoratorType, MemberType } from './indexer/attributeInfo';

// Re-export from other modules
export { interceptConsoleLogger } from './logger';
export { findNamespaceRoots } from './namespaceUtils';

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

// Re-export from file system providers
export { FileSystemDataProvider, IFileSystemProvider } from './providers/fileSystemDataProvider';
export { DirectoryEntry, FileStat, WorkspaceConfig } from './types/fileSystemTypes';
