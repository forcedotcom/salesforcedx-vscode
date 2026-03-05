/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ClassMember,
  AttributeInfo,
  LspFileSystemAccessor,
  normalizePath,
  Logger
} from '@salesforce/salesforcedx-lightning-lsp-common';
import { camelCase, paramCase } from 'change-case';

import * as path from 'node:path';
import { Location, Position, Range } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { Metadata } from './decorators/lwcDecorators';
import { compileSource, extractAttributes, getMethods, toVSCodeRange } from './javascript/compiler';

export type TagAttrs = {
  file?: string;
  metadata?: Metadata;
  updatedAt?: Date;
};

// Type definition for Tag data structure
export type Tag = {
  file: string;
  metadata: Metadata;
  updatedAt: Date;
  _allAttributes?: { publicAttributes: AttributeInfo[]; privateAttributes: AttributeInfo[] } | null;
  _properties?: ClassMember[] | null;
  _methods?: ClassMember[] | null;
};

const attributeDoc = (attribute: AttributeInfo): string => {
  const { name, type, documentation } = attribute;

  if (name && type && documentation) {
    return `- **${name}**: *${type}* ${documentation}`;
  }

  if (name && type) {
    return `- **${name}**: *${type}*`;
  }

  if (name) {
    return `- **${name}**`;
  }

  return '';
};

const methodDoc = (method: ClassMember): string => {
  const { name, doc } = method;

  if (name && doc) {
    return `- **${name}()** *: ${doc}`;
  }
  if (name) {
    return `- **${name}()**`;
  }
  return '';
};

// Utility function to create Tag
export const createTag = async (
  attributes: TagAttrs,
  fileSystemAccessor?: LspFileSystemAccessor
): Promise<Tag> => {
  const file = attributes.file!;
  const metadata = attributes.metadata ?? { decorators: [], exports: [] };

  let updatedAt: Date;

  if (attributes.updatedAt) {
    updatedAt = new Date(attributes.updatedAt);
  } else if (file && fileSystemAccessor) {
    try {
      // file is already normalized, and getFileStat normalizes internally
      const stat = await fileSystemAccessor.getFileStat(`file://${file}`);
      updatedAt = stat ? new Date(stat.mtime) : new Date();
    } catch {
      // If file doesn't exist or can't be read, use current date
      updatedAt = new Date();
    }
  } else {
    updatedAt = new Date();
  }

  return {
    file,
    metadata,
    updatedAt,
    _allAttributes: null,
    _properties: null,
    _methods: null
  };
};

// Utility function to get tag name
export const getTagName = (tag: Tag): string => path.parse(tag.file).name;

// Utility function to get aura name
export const getAuraName = (tag: Tag): string => `c:${camelCase(getTagName(tag))}`;

// Utility function to get LWC name
export const getLwcName = (tag: Tag): string => {
  const name = getTagName(tag);
  return name.includes('_') ? `c-${name}` : `c-${paramCase(name)}`;
};

// Utility function to get LWC typings name
export const getLwcTypingsName = (tag: Tag): string => `c/${getTagName(tag)}`;

// Utility function to get tag URI
// If fileSystemAccessor is provided, uses it to preserve the correct URI scheme (memfs:// or file://)
// Otherwise, falls back to URI.file() for backward compatibility
export const getTagUri = (tag: Tag, fileSystemAccessor?: LspFileSystemAccessor): string => {
  if (fileSystemAccessor) {
    const normalizedPath = normalizePath(tag.file);
    try {
      return fileSystemAccessor.getFileUriForPath(normalizedPath);
    } catch (error) {
      Logger.error(
        `[getTagUri] Error in getFileUriForPath: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
      throw error;
    }
  }

  try {
    const resolvedPath = path.resolve(tag.file);
    const uri = URI.file(resolvedPath).toString();
    return uri;
  } catch (error) {
    Logger.error(
      `[getTagUri] Error creating URI.file: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
    throw error;
  }
};

// Utility function to get all attributes
const getAllAttributes = (tag: Tag): { publicAttributes: AttributeInfo[]; privateAttributes: AttributeInfo[] } => {
  if (tag._allAttributes) {
    return tag._allAttributes;
  }
  const allAttributes = extractAttributes(tag.metadata, getTagUri(tag));
  tag._allAttributes = allAttributes;
  return allAttributes;
};

// Utility function to get public attributes
export const getPublicAttributes = (tag: Tag): AttributeInfo[] => getAllAttributes(tag).publicAttributes;

// Utility function to get methods
const getTagMethods = (tag: Tag): ClassMember[] => {
  if (tag._methods) {
    return tag._methods;
  }
  const methods = getMethods(tag.metadata);
  tag._methods = methods;
  return methods;
};

// Utility function to get API methods
const getApiMethods = (tag: Tag): ClassMember[] => getTagMethods(tag).filter(method => method.decorator === 'api');

// Utility function to get tag range
export const getTagRange = (tag: Tag): Range =>
  tag.metadata.declarationLoc
    ? toVSCodeRange(tag.metadata.declarationLoc)
    : Range.create(Position.create(0, 0), Position.create(0, 0));

// Utility function to get tag location
export const getTagLocation = (tag: Tag, fileSystemAccessor?: LspFileSystemAccessor): Location =>
  Location.create(getTagUri(tag, fileSystemAccessor), getTagRange(tag));

/** Escape glob special characters in a string so it matches literally */
const escapeGlob = (s: string): string => s.replaceAll(/[*?[\]\\{}]/g, '\\$&');

/**
 * Finds files matching baseName.html or baseName.css in a directory using findFilesWithGlobAsync (workspace/findFiles).
 */
const findFilesInDirectory = async (
  dirPath: string,
  baseName: string,
  fileSystemAccessor: LspFileSystemAccessor
): Promise<string[]> => {
  const normalizedDirPath = normalizePath(dirPath);

  const globPattern = `${escapeGlob(baseName)}.{html,css}`;
  return (await fileSystemAccessor.findFilesWithGlobAsync(globPattern, normalizedDirPath)) ?? [];
};

// Utility function to get all locations
export const getAllLocations = async (tag: Tag, fileSystemAccessor: LspFileSystemAccessor): Promise<Location[]> => {
  // tag.file is already normalized (comes from entry.path which is normalized by LspFileSystemAccessor)
  const { dir, name } = path.parse(tag.file);
  // Normalize dir because path.parse() returns backslashes on Windows
  const normalizedDir = normalizePath(dir);

  const convertFileToLocation = (file: string): Location => {
    try {
      // Use fileSystemAccessor to get the correct URI scheme (memfs:// or file://)
      const uri = fileSystemAccessor.getFileUriForPath(normalizePath(file));
      const position = Position.create(0, 0);
      const range = Range.create(position, position);
      const location = Location.create(uri, range);
      return location;
    } catch (error) {
      Logger.error(
        `[getAllLocations] Error converting file to location: ${file} - ${error instanceof Error ? error.message : String(error)}`,
        error
      );
      throw error;
    }
  };

  // Match files like name.html or name.css
  const filteredFiles = await findFilesInDirectory(normalizedDir, name, fileSystemAccessor);

  const locations = filteredFiles.map(convertFileToLocation);

  try {
    const tagLocation = getTagLocation(tag, fileSystemAccessor);
    locations.unshift(tagLocation);
  } catch (error) {
    Logger.error(
      `[getAllLocations] Error getting tag location: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
    throw error;
  }

  return locations;
};

// Utility function to find attribute by name
const findAttribute = (tag: Tag, name: string): AttributeInfo | null =>
  getPublicAttributes(tag).find(attr => attr.name === name) ?? null;

// Utility function to find class member by name
export const findClassMember = (tag: Tag, name: string): ClassMember | null =>
  tag.metadata.classMembers?.find(item => item.name === name) ?? null;

// Utility function to get class members (alias for metadata.classMembers)
export const getClassMembers = (tag: Tag): ClassMember[] => tag.metadata.classMembers ?? [];

// Utility function to find attribute by name (alias for findAttribute)
export const getAttribute = (tag: Tag, name: string): AttributeInfo | null => findAttribute(tag, name);

// Utility function to get class member location
export const getClassMemberLocation = (
  tag: Tag,
  name: string,
  fileSystemAccessor?: LspFileSystemAccessor
): Location | null => {
  const classMember = findClassMember(tag, name);
  if (!classMember?.loc) {
    return null;
  }

  try {
    const tagUri = getTagUri(tag, fileSystemAccessor);
    const range = toVSCodeRange(classMember.loc);
    const location = Location.create(tagUri, range);
    return location;
  } catch (error) {
    Logger.error(
      `[getClassMemberLocation] Error creating location: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
    throw error;
  }
};

// Utility function to get tag description
export const getTagDescription = (tag: Tag): string => {
  const docs: string[] = [getTagDocumentation(tag), getAttributeDocs(tag) ?? '', getMethodDocs(tag) ?? ''];
  return docs.filter(item => item !== null && item !== '').join('\n');
};

// Utility function to get tag documentation
const getTagDocumentation = (tag: Tag): string => tag.metadata.doc ?? '';

// Utility function to get attribute docs
export const getAttributeDocs = (tag: Tag): string | null => {
  const publicAttributes = getPublicAttributes(tag);
  if (publicAttributes.length === 0) {
    return null;
  }
  return ['### Attributes', ...publicAttributes.map(attributeDoc)].join('\n');
};

// Utility function to get method docs
const getMethodDocs = (tag: Tag): string | null => {
  const apiMethods = getApiMethods(tag);
  if (apiMethods.length === 0) {
    return null;
  }
  return ['### Methods', ...apiMethods.map(methodDoc)].join('\n');
};

// Utility function to update tag metadata
export const updateTagMetadata = async (
  tag: Tag,
  meta: Metadata,
  fileSystemAccessor?: LspFileSystemAccessor
): Promise<void> => {
  tag.metadata = meta;
  tag._allAttributes = null;
  tag._methods = null;
  tag._properties = null;
  if (fileSystemAccessor) {
    try {
      // tag.file is already normalized, and getFileStat normalizes internally
      const stat = await fileSystemAccessor.getFileStat(`file://${tag.file}`);
      tag.updatedAt = stat ? new Date(stat.mtime) : new Date();
    } catch {
      // If file doesn't exist or can't be read, use current date
      tag.updatedAt = new Date();
    }
  } else {
    tag.updatedAt = new Date();
  }
};

// Standalone function to create tag from file (replaces static fromFile method)
export const createTagFromFile = async (
  file: string,
  fileSystemAccessor: LspFileSystemAccessor,
  updatedAt?: Date
): Promise<Tag | null> => {
  if (file === '' || file.length === 0) {
    return null;
  }
  const filePath = path.parse(file);
  const fileName = filePath.base;

  try {
    // file is already normalized (comes from entry.path), and getFileContent normalizes internally
    // Try both with and without file:// prefix
    let content = await fileSystemAccessor.getFileContent(file);
    if (!content) {
      const fileWithPrefix = file.startsWith('file://') ? file : `file://${file}`;
      content = await fileSystemAccessor.getFileContent(fileWithPrefix);
    }
    if (!content) {
      return null;
    }
    const data = content;

    if (!(data.includes('from "lwc"') || data.includes("from 'lwc'"))) {
      return null;
    }

    const { metadata, diagnostics } = compileSource(data, fileName);
    if (diagnostics && diagnostics.length > 0) {
      return null;
    }

    if (!metadata) {
      return null;
    }

    const tag = await createTag({ file, metadata, updatedAt });
    return tag;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const errorStack = e instanceof Error ? e.stack : 'No stack trace available';
    Logger.error(`[createTagFromFile] Error creating tag from file ${file}:`);
    Logger.error(`[createTagFromFile] Error message: ${errorMessage}`);
    Logger.error(`[createTagFromFile] Error stack: ${errorStack}`);
    if (e instanceof Error && e.cause) {
      const causeMessage = e.cause instanceof Error ? e.cause.message : String(e.cause);
      Logger.error(`[createTagFromFile] Error cause: ${causeMessage}`);
    }
    return null;
  }
};
