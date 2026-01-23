/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  detectWorkspaceHelper,
  WorkspaceType,
  readJsonSync,
  writeJsonSync,
  SfdxTsConfig,
  TsConfigPaths,
  IFileSystemProvider,
  normalizePath,
  Logger,
  NormalizedPath
} from '@salesforce/salesforcedx-lightning-lsp-common';
import { snakeCase, camelCase } from 'change-case';
import { minimatch as minimatchFn } from 'minimatch';
import * as path from 'node:path';

import { getWorkspaceRoot, getSfdxPackageDirsPattern } from './baseIndexer';

import { Tag, TagAttrs, createTag, createTagFromFile, getTagName, getTagUri } from './tag';

const CUSTOM_COMPONENT_INDEX_PATH = path.join('.sfdx', 'indexes', 'lwc');
const CUSTOM_COMPONENT_INDEX_FILE = path.join(CUSTOM_COMPONENT_INDEX_PATH, 'custom-components.json');
const componentPrefixRegex = new RegExp(/^(?<type>c|lightning|interop){0,1}(?<delimiter>:|-{0,1})(?<name>[\w-]+)$/);

type ComponentIndexerAttributes = {
  workspaceRoot: NormalizedPath;
  fileSystemProvider: IFileSystemProvider;
};

const AURA_DELIMITER = ':';
const LWC_DELIMITER = '-';

// Entry type matching fast-glob's Entry interface
export type Entry = {
  path: string;
  stats?: {
    mtime: Date;
  };
  dirent?: unknown; // Optional dirent for test compatibility
  name?: string; // Optional name for test compatibility
};

const tagEqualsFile = (tag: Tag, entry: Entry): boolean => {
  const fileMatch = tag.file === entry.path;
  const timeMatch = tag.updatedAt?.getTime() === entry.stats?.mtime.getTime();
  return fileMatch && timeMatch;
};

export const unIndexedFiles = (entries: Entry[], tags: Tag[]): Entry[] => {
  const unIndexed = entries.filter(entry => {
    const hasMatchingTag = tags.some(tag => tagEqualsFile(tag, entry));
    return !hasMatchingTag;
  });
  return unIndexed;
};

/**
 * Expands brace patterns like {a,b} into multiple patterns
 */
const expandBraces = (pattern: string): string[] => {
  const braceMatch = pattern.match(/\{([^}]+)\}/);
  if (!braceMatch) {
    return [pattern];
  }

  const [fullMatch, alternatives] = braceMatch;
  const options = alternatives.split(',').map((opt: string) => opt.trim());
  const results: string[] = [];

  for (const option of options) {
    const expanded = pattern.replace(fullMatch, option);
    // Recursively expand any remaining braces
    results.push(...expandBraces(expanded));
  }

  return results;
};

/**
 * Traverses directories using FileSystemDataProvider and matches files against a glob pattern
 * This replaces fast-glob for web compatibility
 */
const findFilesWithGlob = (pattern: string, fileSystemProvider: IFileSystemProvider, basePath: string): Entry[] => {
  const results: Entry[] = [];
  // Normalize basePath the same way FileSystemDataProvider normalizes paths
  const normalizedBasePath = normalizePath(basePath);

  // Expand brace patterns like {force-app,utils} into multiple patterns
  const patterns = expandBraces(pattern);

  // Use getAllFileUris as a reliable source of all files in the provider
  // This ensures we don't miss files even if directory listings are incomplete
  const allFileUris = fileSystemProvider.getAllFileUris();

  for (const fileUri of allFileUris) {
    // fileUri is already normalized by FileSystemDataProvider (normalized when stored via updateFileContent/updateFileStat)
    // Skip files outside the workspace by checking if the file path starts with the base path
    // This is more reliable than path.posix.relative on Windows where drive letter case mismatches
    // can cause path.posix.relative to return paths starting with ../ even for files in the workspace
    // Use case-insensitive comparison on Windows for drive letters
    const basePathLower = normalizedBasePath.toLowerCase();
    const fileUriLower = fileUri.toLowerCase();
    const basePathWithSlash = `${basePathLower}/`;
    const startsWithCheck = fileUriLower.startsWith(basePathWithSlash) || fileUriLower === basePathLower;

    if (!startsWithCheck) {
      continue;
    }

    // Calculate relative path - if path.posix.relative fails (returns absolute path),
    // manually compute it by removing the base path prefix
    let relativePath = path.posix.relative(normalizedBasePath, fileUri);
    const isAbsoluteRelative = path.posix.isAbsolute(relativePath);

    if (isAbsoluteRelative) {
      // path.posix.relative failed (e.g., drive letter mismatch on Windows)
      // Since we've already verified the file is in the workspace via startsWith,
      // manually compute the relative path by removing the base path prefix
      if (fileUriLower.startsWith(basePathWithSlash)) {
        relativePath = fileUri.substring(normalizedBasePath.length + 1);
      } else if (fileUriLower === basePathLower) {
        // File is the workspace root itself
        relativePath = '.';
      } else {
        // Should not happen given the startsWith check above, but skip to be safe
        continue;
      }
    }

    // Check if file matches any of the patterns using minimatc
    const matches = patterns.some(
      p => minimatchFn(relativePath, p, { dot: true }) || minimatchFn(fileUri, p, { dot: true })
    );

    if (matches) {
      const fileStat = fileSystemProvider.getFileStat(fileUri);
      results.push({
        path: fileUri,
        stats: fileStat
          ? {
              mtime: new Date(fileStat.mtime)
            }
          : undefined
      });
    }
  }

  return results;
};

export default class ComponentIndexer {
  public readonly workspaceRoot: NormalizedPath;
  public workspaceType: WorkspaceType = 'UNKNOWN';
  public readonly tags: Map<string, Tag> = new Map();
  public readonly fileSystemProvider: IFileSystemProvider;

  constructor(private readonly attributes: ComponentIndexerAttributes) {
    this.workspaceRoot = getWorkspaceRoot(attributes.workspaceRoot);
    this.fileSystemProvider = attributes.fileSystemProvider;
  }

  private getSfdxPackageDirsPattern(): string {
    return getSfdxPackageDirsPattern(this.attributes.workspaceRoot, this.fileSystemProvider);
  }

  // visible for testing
  public getComponentEntries(): Entry[] {
    let files: Entry[] = [];

    switch (this.workspaceType) {
      case 'SFDX':
        // workspaceRoot is already normalized by getWorkspaceRoot()
        const packageDirsPattern = this.getSfdxPackageDirsPattern();
        // Pattern matches: {packageDir}/**/*/lwc/**/*.js
        // The **/* before lwc requires at least one directory level (e.g., main/default/lwc or meta/lwc)
        const sfdxPattern = `${packageDirsPattern}/**/*/lwc/**/*.js`;
        files = findFilesWithGlob(sfdxPattern, this.fileSystemProvider, this.workspaceRoot);
        const filteredFiles = files.filter((item: Entry): boolean => {
          const data = path.parse(item.path);
          const dirEndsWithName = data.dir.endsWith(data.name);
          return dirEndsWithName;
        });
        return filteredFiles;
      default:
        // For CORE_ALL and CORE_PARTIAL
        // workspaceRoot is already normalized by getWorkspaceRoot()
        const defaultPattern = '**/*/modules/**/*.js';
        files = findFilesWithGlob(defaultPattern, this.fileSystemProvider, this.workspaceRoot);
        const filteredFilesDefault = files.filter((item: Entry): boolean => {
          const data = path.parse(item.path);
          const dirEndsWithName = data.dir.endsWith(data.name);
          return dirEndsWithName;
        });
        return filteredFilesDefault;
    }
  }

  public getCustomData(): Tag[] {
    return Array.from(this.tags.values());
  }

  public findTagByName(query: string): Tag | null {
    try {
      const matches = componentPrefixRegex.exec(query);
      if (!matches?.groups) {
        return this.tags.get(query) ?? null;
      }
      const { delimiter, name } = matches.groups;
      if (delimiter === AURA_DELIMITER && !/[-_]+/.test(name)) {
        return this.tags.get(name) ?? this.tags.get(snakeCase(name)) ?? null;
      }
      if (delimiter === LWC_DELIMITER) {
        return this.tags.get(name) ?? this.tags.get(camelCase(name)) ?? null;
      }
      return this.tags.get(query) ?? null;
    } catch {
      return null;
    }
  }

  public findTagByURI(uri: string): Tag | null {
    const uriText = uri.replace('.html', '.js');
    return Array.from(this.tags.values()).find(tag => getTagUri(tag) === uriText) ?? null;
  }

  private async loadTagsFromIndex(): Promise<void> {
    try {
      const indexPath: string = path.join(this.workspaceRoot, CUSTOM_COMPONENT_INDEX_FILE);

      if (this.fileSystemProvider.fileExists(indexPath)) {
        const content = this.fileSystemProvider.getFileContent(indexPath);
        if (content) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const index: TagAttrs[] = JSON.parse(content);
          for (const data of index) {
            const info = await createTag(data);
            const tagName = getTagName(info);
            this.tags.set(tagName, info);
          }
        }
      }
    } catch (err) {
      Logger.error('[ComponentIndexer.loadTagsFromIndex] Error loading tags from index:', err);
    }
  }

  public persistCustomComponents(): void {
    const indexJsonString = JSON.stringify(this.getCustomData());

    // Store the component index data for the client to process
    void this.fileSystemProvider.updateFileContent('lwc:componentIndex', indexJsonString);
  }

  public async insertSfdxTsConfigPath(filePaths: string[]): Promise<void> {
    // FileSystemDataProvider.normalizePath() handles all normalization (unixify + drive letter case)
    const sfdxTsConfigPath = path.join(this.workspaceRoot, '.sfdx', 'tsconfig.sfdx.json');

    const fileExists = this.fileSystemProvider.fileExists(sfdxTsConfigPath);

    if (fileExists) {
      try {
        const sfdxTsConfig: SfdxTsConfig = await readJsonSync(sfdxTsConfigPath, this.fileSystemProvider);
        sfdxTsConfig.compilerOptions = sfdxTsConfig.compilerOptions ?? { paths: {} };
        sfdxTsConfig.compilerOptions.paths = sfdxTsConfig.compilerOptions.paths ?? {};
        // Update TypeScript path mappings to include component file paths.
        // This enables TypeScript to resolve LWC component imports (e.g., `c/myComponent`).
        // The loop mutates the config object by reference - changes are persisted when writeJsonSync is called.
        for (const filePath of filePaths) {
          const { dir, name: fileName } = path.parse(filePath);
          const componentName = `c/${fileName}`;
          const componentFilePath = path.join(dir, fileName);
          const paths = (sfdxTsConfig.compilerOptions.paths[componentName] ??= []);
          if (!paths.includes(componentFilePath)) {
            paths.push(componentFilePath);
          }
        }
        writeJsonSync(sfdxTsConfigPath, sfdxTsConfig, this.fileSystemProvider);
      } catch (err) {
        Logger.error(err);
      }
    }
  }

  // This is a temporary solution to enable automated LWC module resolution for TypeScript modules.
  // It is intended to update the path mapping in the .sfdx/tsconfig.sfdx.json file.
  // TODO: Once the LWC custom module resolution plugin has been developed in the language server
  // this can be removed.
  public updateSfdxTsConfigPath(): void {
    const sfdxTsConfigPath = path.join(this.workspaceRoot, '.sfdx', 'tsconfig.sfdx.json');

    const fileExists = this.fileSystemProvider.fileExists(sfdxTsConfigPath);

    if (fileExists) {
      try {
        const content = this.fileSystemProvider.getFileContent(sfdxTsConfigPath);
        if (content) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const sfdxTsConfig: SfdxTsConfig = JSON.parse(content);
          // The assumption here is that sfdxTsConfig will not be modified by the user as
          // it is located in the .sfdx directory.
          sfdxTsConfig.compilerOptions = sfdxTsConfig.compilerOptions ?? { paths: {} };
          sfdxTsConfig.compilerOptions.paths = this.getTsConfigPathMapping();

          // Update the actual tsconfig file
          void this.fileSystemProvider.updateFileContent(sfdxTsConfigPath, JSON.stringify(sfdxTsConfig, null, 2));
        }
      } catch (err) {
        Logger.error(err);
      }
    }
  }

  // visible for testing
  public getTsConfigPathMapping(): TsConfigPaths {
    const files: TsConfigPaths = {};
    if (this.workspaceType === 'SFDX') {
      // workspaceRoot is already normalized by getWorkspaceRoot()
      const packageDirsPattern = this.getSfdxPackageDirsPattern();
      // Use **/* after lwc to match any depth (e.g., utils/meta/lwc/todo_util/todo_util.js)
      // Construct glob pattern with forward slashes (path.join uses backslashes on Windows)
      // Normalize packageDirsPattern to ensure forward slashes
      const normalizedPackageDirs = normalizePath(packageDirsPattern);
      const sfdxPattern = `${normalizedPackageDirs}/**/*/lwc/**/*.{js,ts}`;
      const filePaths = findFilesWithGlob(sfdxPattern, this.fileSystemProvider, this.workspaceRoot);
      for (const filePath of filePaths) {
        const { dir, name: fileName } = path.parse(filePath.path);
        const folderName = path.basename(dir);
        if (folderName === fileName) {
          const componentName = `c/${fileName}`;
          // Normalize path to ensure consistent forward slashes (path.join uses backslashes on Windows)
          const componentFilePath = normalizePath(path.join(dir, fileName));
          files[componentName] = files[componentName] ?? [];
          if (!files[componentName].includes(componentFilePath)) {
            files[componentName].push(componentFilePath);
          }
        }
      }
    }
    return files;
  }

  private getUnIndexedFiles(): Entry[] {
    const componentEntries = this.getComponentEntries();
    const customData = this.getCustomData();
    const unIndexed = unIndexedFiles(componentEntries, customData);
    return unIndexed;
  }

  public getStaleTags(): Tag[] {
    const componentEntries = this.getComponentEntries();

    return this.getCustomData().filter(tag => !componentEntries.some(entry => entry.path === tag.file));
  }

  public async init(): Promise<void> {
    this.workspaceType = await detectWorkspaceHelper(this.attributes.workspaceRoot, this.fileSystemProvider);

    await this.loadTagsFromIndex();

    const unIndexedFilesResult = this.getUnIndexedFiles();
    const promises = unIndexedFilesResult.map(async entry => {
      const tag = await createTagFromFile(entry.path, this.fileSystemProvider, entry.stats?.mtime);
      return tag;
    });
    const tags = await Promise.all(promises);

    const validTags: Tag[] = [];
    tags.forEach(tag => {
      if (tag) {
        validTags.push(tag);
      }
    });
    validTags.forEach(tag => {
      const tagName = getTagName(tag);
      this.tags.set(tagName, tag);
    });

    const staleTags = this.getStaleTags();
    staleTags.forEach(tag => {
      if (tag) {
        this.tags.delete(getTagName(tag));
      }
    });

    this.persistCustomComponents();
  }
}
