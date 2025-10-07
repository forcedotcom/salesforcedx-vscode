/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export {
    toResolvedPath,
    isLWCWatchedDirectory,
    isAuraWatchedDirectory,
    includesDeletedLwcWatchedDirectory,
    includesDeletedAuraWatchedDirectory,
    containsDeletedLwcWatchedDirectory,
    isLWCRootDirectoryCreated,
    isAuraRootDirectoryCreated,
    unixify,
    relativePath,
    pathStartsWith,
    getExtension,
    getBasename,
    getSfdxResource,
    getCoreResource,
    appendLineIfMissing,
    deepMerge,
    elapsedMillis,
    memoize,
    readJsonSync,
    writeJsonSync,
} from './utils';

// Re-export from base-context
export { BaseWorkspaceContext, Indexer, AURA_EXTENSIONS, processTemplate, getModulesDirs, updateForceIgnoreFile } from './baseContext';

// Re-export from shared
export { WorkspaceType, isLWC, getSfdxProjectFile, detectWorkspaceHelper, detectWorkspaceType } from './shared';

// Re-export from indexer
export {
    TagInfo,
    createTagInfo,
    getAttributeInfo,
    getHover,
    getComponentLibraryLink,
    getAttributeMarkdown,
    getMethodMarkdown,
    TagType,
} from './indexer/tagInfo';
export { AttributeInfo, createAttributeInfo, DecoratorType, MemberType } from './indexer/attributeInfo';

// Re-export from other modules
export { interceptConsoleLogger } from './logger';
export { findNamespaceRoots } from './namespaceUtils';

// Re-export from decorators
export { ClassMember, Location, Position, ClassMemberPropertyValue, DecoratorTargetType, DecoratorTargetProperty, DecoratorTargetMethod } from './decorators';
