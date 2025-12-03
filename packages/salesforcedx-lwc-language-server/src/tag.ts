/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ClassMember,
  AttributeInfo,
  IFileSystemProvider,
  normalizePath
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
export const createTag = async (attributes: TagAttrs, fileSystemProvider?: IFileSystemProvider): Promise<Tag> => {
  const file = attributes.file!;
  const metadata = attributes.metadata!;

  // if (!metadata) {
  //     throw new Error('Metadata is required to create a tag');
  // }

  let updatedAt: Date;

  if (attributes.updatedAt) {
    updatedAt = new Date(attributes.updatedAt);
  } else if (file && fileSystemProvider) {
    try {
      // file is already normalized, and getFileStat normalizes internally
      const stat = fileSystemProvider.getFileStat(`file://${file}`);
      if (stat) {
        updatedAt = new Date(stat.mtime);
      } else {
        updatedAt = new Date();
      }
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
  if (name.includes('_')) {
    return `c-${name}`;
  } else {
    return `c-${paramCase(name)}`;
  }
};

// Utility function to get LWC typings name
export const getLwcTypingsName = (tag: Tag): string => `c/${getTagName(tag)}`;

// Utility function to get tag URI
export const getTagUri = (tag: Tag): string => URI.file(path.resolve(tag.file)).toString();

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
export const getTagRange = (tag: Tag): Range => {
  if (tag.metadata.declarationLoc) {
    return toVSCodeRange(tag.metadata.declarationLoc);
  } else {
    return Range.create(Position.create(0, 0), Position.create(0, 0));
  }
};

// Utility function to get tag location
export const getTagLocation = (tag: Tag): Location => Location.create(getTagUri(tag), getTagRange(tag));

/**
 * Finds files matching a pattern in a directory using FileSystemDataProvider
 * This replaces fast-glob for web compatibility
 */
const findFilesInDirectory = (dirPath: string, pattern: RegExp, fileSystemProvider: IFileSystemProvider): string[] => {
  const results: string[] = [];
  // Normalize path the same way FileSystemDataProvider normalizes paths
  const normalizedDirPath = normalizePath(dirPath);
  console.log(`[findFilesInDirectory] Looking for files in directory: ${dirPath} (normalized: ${normalizedDirPath})`);
  console.log(`[findFilesInDirectory] Pattern: ${pattern}`);

  if (!fileSystemProvider.directoryExists(normalizedDirPath)) {
    console.log(`[findFilesInDirectory] Directory does not exist: ${normalizedDirPath}`);
    return results;
  }

  const entries = fileSystemProvider.getDirectoryListing(normalizedDirPath);
  console.log(`[findFilesInDirectory] Found ${entries.length} entries in directory`);
  for (const entry of entries) {
    if (entry.type === 'file') {
      // Use entry.name directly instead of parsing entry.uri to avoid path parsing issues on Windows
      const matches = pattern.test(entry.name);
      console.log(`[findFilesInDirectory] Checking entry: ${entry.name} (uri: ${entry.uri}) - matches: ${matches}`);
      if (matches) {
        results.push(entry.uri);
        console.log(`[findFilesInDirectory] Added file to results: ${entry.uri}`);
      }
    }
  }

  console.log(`[findFilesInDirectory] Returning ${results.length} matching files`);
  return results;
};

// Utility function to get all locations
export const getAllLocations = (tag: Tag, fileSystemProvider: IFileSystemProvider): Location[] => {
  // tag.file is already normalized (comes from entry.path which is normalized by FileSystemDataProvider)
  const { dir, name } = path.parse(tag.file);
  // Normalize dir because path.parse() returns backslashes on Windows
  const normalizedDir = normalizePath(dir);
  console.log(`[getAllLocations] Getting locations for tag: ${getTagName(tag)}, file: ${tag.file}`);
  console.log(`[getAllLocations] Parsed dir: ${dir}, name: ${name}, normalizedDir: ${normalizedDir}`);

  const convertFileToLocation = (file: string): Location => {
    const uri = URI.file(file).toString();
    const position = Position.create(0, 0);
    const range = Range.create(position, position);
    return Location.create(uri, range);
  };

  // Match files like name.html or name.css
  const pattern = new RegExp(`^${name.replace(/[.+^${}()|[\]\\]/g, '\\$&')}\\.(html|css)$`);
  console.log(`[getAllLocations] Pattern for matching files: ${pattern}`);
  const filteredFiles = findFilesInDirectory(normalizedDir, pattern, fileSystemProvider);
  console.log(`[getAllLocations] Found ${filteredFiles.length} matching files: ${filteredFiles.join(', ')}`);
  const locations = filteredFiles.map(convertFileToLocation);
  const tagLocation = getTagLocation(tag);
  locations.unshift(tagLocation);
  console.log(`[getAllLocations] Returning ${locations.length} locations (including tag location)`);

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
export const getClassMemberLocation = (tag: Tag, name: string): Location | null => {
  const classMember = findClassMember(tag, name);
  if (!classMember?.loc) {
    return null;
  }
  return Location.create(getTagUri(tag), toVSCodeRange(classMember.loc));
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
  meta: any,
  fileSystemProvider?: IFileSystemProvider
): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  tag.metadata = meta;
  tag._allAttributes = null;
  tag._methods = null;
  tag._properties = null;
  if (fileSystemProvider) {
    try {
      // tag.file is already normalized, and getFileStat normalizes internally
      const stat = fileSystemProvider.getFileStat(`file://${tag.file}`);
      if (stat) {
        tag.updatedAt = new Date(stat.mtime);
      } else {
        tag.updatedAt = new Date();
      }
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
  fileSystemProvider: IFileSystemProvider,
  updatedAt?: Date
): Promise<Tag | null> => {
  console.log(`[createTagFromFile] Attempting to create tag from file: ${file}`);
  if (file === '' || file.length === 0) {
    console.log('[createTagFromFile] File is empty, returning null');
    return null;
  }
  const filePath = path.parse(file);
  const fileName = filePath.base;
  console.log(
    `[createTagFromFile] Parsed path - dir: "${filePath.dir}", base: "${filePath.base}", name: "${filePath.name}", ext: "${filePath.ext}"`
  );

  try {
    // file is already normalized (comes from entry.path), and getFileContent normalizes internally
    console.log(`[createTagFromFile] Attempting to read file content from fileSystemProvider for: ${file}`);
    // Try both with and without file:// prefix
    let content = fileSystemProvider.getFileContent(file);
    if (!content) {
      const fileWithPrefix = file.startsWith('file://') ? file : `file://${file}`;
      console.log(`[createTagFromFile] No content with direct path, trying with file:// prefix: ${fileWithPrefix}`);
      content = fileSystemProvider.getFileContent(fileWithPrefix);
    }
    if (!content) {
      console.log(`[createTagFromFile] No content found for file: ${file}, returning null`);
      // Try alternative paths to see if file exists with different casing or format
      const allFileUris = fileSystemProvider.getAllFileUris();
      const fileLower = file.toLowerCase();
      const matchingFiles = allFileUris.filter(uri => {
        const uriLower = uri.toLowerCase();
        return uriLower === fileLower || uriLower.endsWith(fileLower) || fileLower.endsWith(uriLower);
      });
      console.log(
        `[createTagFromFile] Searched ${allFileUris.length} total files, found ${matchingFiles.length} files with similar path`
      );
      if (matchingFiles.length > 0 && matchingFiles.length <= 10) {
        console.log(`[createTagFromFile] Similar files: ${matchingFiles.join(', ')}`);
      } else if (matchingFiles.length > 10) {
        console.log(`[createTagFromFile] Similar files (first 5): ${matchingFiles.slice(0, 5).join(', ')}`);
      }
      return null;
    }
    const data = content;
    console.log(`[createTagFromFile] File content length: ${data.length} characters`);
    if (data.length > 0 && data.length <= 500) {
      console.log(`[createTagFromFile] File content preview (first 200 chars): ${data.substring(0, 200)}`);
    }

    if (!(data.includes('from "lwc"') || data.includes("from 'lwc'"))) {
      console.log('[createTagFromFile] File does not contain \'from "lwc"\' or "from \'lwc\'", returning null');
      return null;
    }

    console.log(`[createTagFromFile] Calling compileSource for fileName: ${fileName}`);
    const { metadata, diagnostics } = compileSource(data, fileName);
    console.log(
      `[createTagFromFile] compileSource returned - metadata: ${metadata ? 'present' : 'null'}, diagnostics: ${diagnostics?.length ?? 0}`
    );
    if (diagnostics && diagnostics.length > 0) {
      console.log(`[createTagFromFile] Compilation diagnostics found (${diagnostics.length}), returning null`);
      if (diagnostics.length <= 10) {
        console.log(
          `[createTagFromFile] Diagnostic details: ${diagnostics.map(d => `${d.message} (line ${d.range?.start?.line ?? 'unknown'})`).join(', ')}`
        );
      } else {
        console.log(
          `[createTagFromFile] First 5 diagnostic details: ${diagnostics
            .slice(0, 5)
            .map(d => `${d.message} (line ${d.range?.start?.line ?? 'unknown'})`)
            .join(', ')}`
        );
      }
      return null;
    }

    if (!metadata) {
      console.log('[createTagFromFile] No metadata found, returning null');
      return null;
    }
    console.log(
      `[createTagFromFile] Metadata found - classMembers: ${metadata.classMembers?.length ?? 0}, decorators: ${metadata.decorators?.length ?? 0}`
    );
    if (metadata.classMembers && metadata.classMembers.length > 0 && metadata.classMembers.length <= 20) {
      console.log(
        `[createTagFromFile] Class member names: ${metadata.classMembers.map(cm => `${cm.name} (${cm.type})`).join(', ')}`
      );
    }

    const tag = await createTag({ file, metadata, updatedAt });
    console.log(`[createTagFromFile] Successfully created tag for file: ${file}, tag name: ${getTagName(tag)}`);
    return tag;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const errorStack = e instanceof Error ? e.stack : 'No stack trace available';
    console.error(`[createTagFromFile] Error creating tag from file ${file}:`);
    console.error(`[createTagFromFile] Error message: ${errorMessage}`);
    console.error(`[createTagFromFile] Error stack: ${errorStack}`);
    if (e instanceof Error && e.cause) {
      const causeMessage = e.cause instanceof Error ? e.cause.message : String(e.cause);
      console.error(`[createTagFromFile] Error cause: ${causeMessage}`);
    }
    return null;
  }
};
