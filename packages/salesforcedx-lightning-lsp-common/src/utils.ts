/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { basename, extname, join, ParsedPath, parse as parsePath, relative, resolve, sep } from 'node:path';
import { FileEvent, FileChangeType } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { BaseWorkspaceContext } from './baseContext';
import { IFileSystemProvider } from './providers/fileSystemDataProvider';

const RESOURCES_DIR = 'resources';

export interface SfdxTsConfig {
  compilerOptions?: {
    paths?: TsConfigPaths;
  };
}

export interface TsConfigPaths {
  [key: string]: string[];
}

// Type guard for Record<string, unknown>
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const toResolvedPath = (uri: string): string => {
  const parsed = URI.parse(uri);
  // For file:// URIs, use fsPath (handles Windows paths correctly)
  // For other schemes (memfs://, etc.), use path property
  // If no scheme is present (plain path), treat it as a file path
  const pathToResolve = parsed.scheme === 'file' ? parsed.fsPath : parsed.scheme ? parsed.path : uri;
  return resolve(pathToResolve);
};

const isLWCRootDirectory = (context: BaseWorkspaceContext, uri: string): boolean => {
  if (context.type === 'SFDX') {
    const file = toResolvedPath(uri);
    return file.endsWith('lwc');
  }
  return false;
};

export const isLWCRootDirectoryCreated = (context: BaseWorkspaceContext, changes: FileEvent[]): boolean => {
  for (const event of changes) {
    if (event.type === FileChangeType.Created && isLWCRootDirectory(context, event.uri)) {
      return true;
    }
  }
  return false;
};

const unixify = (filePath: string): string => filePath.replaceAll('\\', '/');

/**
 * Branded type for normalized paths.
 * This ensures type safety by preventing mixing normalized and non-normalized paths.
 */
export type NormalizedPath = string & { readonly __brand: 'NormalizedPath' };

/**
 * Normalizes a path for consistent storage and matching in FileSystemDataProvider.
 * Converts backslashes to forward slashes (unixify) and normalizes Windows drive letters to lowercase.
 * This ensures paths match regardless of drive letter casing (Windows file system is case-insensitive,
 * but JavaScript Map keys are case-sensitive).
 *
 * @returns A branded NormalizedPath type to prevent mixing with non-normalized paths
 */
export const normalizePath = (filePath: string): NormalizedPath => {
  const unixified = unixify(filePath);
  // Normalize Windows drive letter to lowercase (e.g., "D:/path" -> "d:/path")
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return unixified.replace(/^([A-Z]):/, (_match: string, drive: string) => `${drive.toLowerCase()}:`) as NormalizedPath;
};

export const relativePath = (from: string, to: string): string => unixify(relative(from, to));

export const pathStartsWith = (path: string, root: string): boolean => {
  if (process.platform === 'win32') {
    return path.toLowerCase().startsWith(root.toLowerCase());
  }
  return path.startsWith(root);
};

export const getExtension = (textDocument: TextDocument): string => {
  const filePath = URI.parse(textDocument.uri).fsPath;
  return filePath ? extname(filePath) : '';
};

export const getBasename = (textDocument: TextDocument): string => {
  const filePath = URI.parse(textDocument.uri).fsPath;
  const ext = extname(filePath);
  return filePath ? basename(filePath, ext) : '';
};

export const getSfdxResource = (resourceName: string): string => join(__dirname, RESOURCES_DIR, 'sfdx', resourceName);

export const memoize = <T>(fn: () => T): (() => T) => {
  let cache: T | undefined;
  return (): T => {
    if (cache !== undefined) {
      return cache;
    }
    cache = fn();
    return cache;
  };
};

export const readJsonSync = async (file: string, fileSystemProvider: IFileSystemProvider): Promise<SfdxTsConfig> => {
  try {
    const content = fileSystemProvider.getFileContent(`${file}`);
    if (!content) {
      return {};
    }
    // Dynamically import tiny-jsonc (ES module) and parse JSONC content
    // Comments will be lost if this object is written back to file.
    // Individual properties should be updated directly via VS Code API to preserve comments.

    const { parse } = (await import('tiny-jsonc')).default;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = parse(content);
    return isRecord(parsed) ? parsed : {};
  } catch (err) {
    console.log(`onIndexCustomComponents(LOTS): Error reading jsconfig ${file}`, err);
    return {};
  }
};

export const writeJsonSync = (file: string, json: SfdxTsConfig, fileSystemProvider: IFileSystemProvider): void => {
  const content = JSON.stringify(json, null, 4);
  void fileSystemProvider.updateFileContent(`${file}`, content);
};

/**
 * Extracts the actual JSON content from a JSON import.
 * TypeScript treats JSON imports as default exports, but runtime may wrap them differently.
 * This function handles both cases: when the JSON is in `.default` or directly on the import.
 *
 * For namespace imports (`import * as json`), the structure can be:
 * - `{ default: {...json...}, ...json... }` - both default and spread properties
 * - `{ default: {...json...} }` - only default property
 * - `{ ...json... }` - only spread properties (no default)
 *
 * We prefer `.default` if it exists and is an object, otherwise use the namespace itself.
 */
export const extractJsonFromImport = <T = unknown>(jsonImport: unknown): T => {
  if (!jsonImport || typeof jsonImport !== 'object' || jsonImport === null || Array.isArray(jsonImport)) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return jsonImport as T;
  }

  // Check if it has a 'default' property that is an object (not an array)
  // Use type assertion to access default property safely
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const jsonImportObj = jsonImport as { default?: unknown };
  const defaultProp = jsonImportObj.default;

  if (defaultProp && typeof defaultProp === 'object' && defaultProp !== null && !Array.isArray(defaultProp)) {
    // Prefer the default property if it exists and is a valid object
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return defaultProp as T;
  }

  // Otherwise, return the import itself (it's the JSON directly, possibly with spread properties)
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return jsonImport as T;
};

// TODO investigate more why this happens
const splitPath = (filePath: ParsedPath): string[] => {
  let pathElements = filePath.dir.split(sep);
  // Somehow on windows paths are occassionally using forward slash
  if (sep === '\\' && !filePath.dir.includes('\\')) {
    pathElements = filePath.dir.split('/');
  }
  return pathElements;
};

/**
 * Extracts a component name from a file path.
 * For SFDX projects, uses namespace 'c'. For non-SFDX, extracts namespace from path.
 * Returns null if the file name doesn't match the parent directory name.
 *
 * @param file - The file path
 * @param sfdxProject - Whether this is an SFDX project
 * @param converter - Function to convert namespace and tag to final component name
 * @returns The component name or null if extraction fails
 */
export const nameFromFile = (
  file: string,
  sfdxProject: boolean,
  converter: (a: string, b: string) => string
): string | null => {
  const filePath = parsePath(file);
  const fileName = filePath.name;
  const pathElements = splitPath(filePath);
  const parentDirName = pathElements.pop();
  if (fileName === parentDirName) {
    const namespace = sfdxProject ? 'c' : pathElements.pop();
    return converter(namespace ?? '', parentDirName);
  }
  return null;
};

/**
 * Extracts a component name from a directory path.
 * For SFDX projects, uses namespace 'c'. For non-SFDX, extracts namespace from path.
 *
 * @param file - The directory path
 * @param sfdxProject - Whether this is an SFDX project
 * @param converter - Function to convert namespace and tag to final component name
 * @returns The component name
 */
export const nameFromDirectory = (
  file: string,
  sfdxProject: boolean,
  converter: (a: string, b: string) => string
): string => {
  const filePath = parsePath(file);
  return sfdxProject ? converter('c', filePath.name) : converter(splitPath(filePath).pop() ?? '', filePath.name);
};

const componentName = (namespace: string, tag: string): string => `${namespace}:${tag}`;

/**
 * Extracts a component name in "namespace:component" format from a file path.
 * For SFDX projects, uses namespace 'c'. For non-SFDX, extracts namespace from path.
 * Returns null if the file name doesn't match the parent directory name.
 *
 * @param file - The file path
 * @param sfdxProject - Whether this is an SFDX project
 * @returns The component name in "namespace:component" format or null if extraction fails
 */
export const componentFromFile = (file: string, sfdxProject: boolean): string | null =>
  nameFromFile(file, sfdxProject, componentName);

/**
 * Extracts a component name in "namespace:component" format from a directory path.
 * For SFDX projects, uses namespace 'c'. For non-SFDX, extracts namespace from path.
 *
 * @param file - The directory path
 * @param sfdxProject - Whether this is an SFDX project
 * @returns The component name in "namespace:component" format
 */
export const componentFromDirectory = (file: string, sfdxProject: boolean): string =>
  nameFromDirectory(file, sfdxProject, componentName);
