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
  normalizePath
} from '@salesforce/salesforcedx-lightning-lsp-common';
import { snakeCase, camelCase } from 'change-case';
// glob-to-regexp is correctly listed in this package's package.json dependencies,
// but eslint-plugin-import's no-extraneous-dependencies rule doesn't properly detect
// dependencies in monorepo setups (it checks the root package.json instead of the package's own)
// eslint-disable-next-line import/no-extraneous-dependencies
import globToRegExp from 'glob-to-regexp';
import * as path from 'node:path';

import { getWorkspaceRoot, getSfdxPackageDirsPattern } from './baseIndexer';

import { Tag, TagAttrs, createTag, createTagFromFile, getTagName, getTagUri } from './tag';

const CUSTOM_COMPONENT_INDEX_PATH = path.join('.sfdx', 'indexes', 'lwc');
const CUSTOM_COMPONENT_INDEX_FILE = path.join(CUSTOM_COMPONENT_INDEX_PATH, 'custom-components.json');
const componentPrefixRegex = new RegExp(/^(?<type>c|lightning|interop){0,1}(?<delimiter>:|-{0,1})(?<name>[\w-]+)$/);

type ComponentIndexerAttributes = {
  workspaceRoot: string;
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

const tagEqualsFile = (tag: Tag, entry: Entry): boolean =>
  tag.file === entry.path && tag.updatedAt?.getTime() === entry.stats?.mtime.getTime();

export const unIndexedFiles = (entries: Entry[], tags: Tag[]): Entry[] =>
  entries.filter(entry => !tags.some(tag => tagEqualsFile(tag, entry)));

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

  console.log(`[findFilesWithGlob] pattern: ${pattern}`);
  console.log(`[findFilesWithGlob] basePath (original): ${basePath}`);
  console.log(`[findFilesWithGlob] normalizedBasePath: ${normalizedBasePath}`);

  // Expand brace patterns like {force-app,utils} into multiple patterns
  const patterns = expandBraces(pattern);
  const regexes = patterns.map(p => globToRegExp(p, { globstar: true, extended: true }));
  console.log(`[findFilesWithGlob] expanded patterns: ${JSON.stringify(patterns)}`);

  // Use getAllFileUris as a reliable source of all files in the provider
  // This ensures we don't miss files even if directory listings are incomplete
  const allFileUris = fileSystemProvider.getAllFileUris();
  console.log(`[findFilesWithGlob] total files in provider: ${allFileUris.length}`);

  let filesInWorkspace = 0;
  let filesFilteredByStartsWith = 0;
  let filesMatched = 0;

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

    // Log detailed comparison for first few files to diagnose path matching issues
    if (filesInWorkspace + filesFilteredByStartsWith < 5) {
      console.log(
        `[findFilesWithGlob] Path comparison - fileUri: "${fileUri}" | normalizedBasePath: "${normalizedBasePath}" | fileUriLower: "${fileUriLower}" | basePathLower: "${basePathLower}" | startsWithCheck: ${startsWithCheck}`
      );
    }

    if (!startsWithCheck) {
      filesFilteredByStartsWith++;
      if (filesFilteredByStartsWith <= 5) {
        // Log first 5 filtered files for debugging
        console.log(`[findFilesWithGlob] FILTERED (startsWith): ${fileUri} (base: ${normalizedBasePath})`);
      }
      continue;
    }

    filesInWorkspace++;

    // Calculate relative path - if path.posix.relative fails (returns absolute path),
    // manually compute it by removing the base path prefix
    let relativePath = path.posix.relative(normalizedBasePath, fileUri);
    const isAbsoluteRelative = path.posix.isAbsolute(relativePath);

    // Log path.posix.relative results for first few files to diagnose Windows path issues
    if (filesInWorkspace <= 5) {
      console.log(
        `[findFilesWithGlob] path.posix.relative result - base: "${normalizedBasePath}" | file: "${fileUri}" | relative: "${relativePath}" | isAbsolute: ${isAbsoluteRelative}`
      );
    }

    if (isAbsoluteRelative) {
      // path.posix.relative failed (e.g., drive letter mismatch on Windows)
      // Since we've already verified the file is in the workspace via startsWith,
      // manually compute the relative path by removing the base path prefix
      if (fileUriLower.startsWith(basePathWithSlash)) {
        relativePath = fileUri.substring(normalizedBasePath.length + 1);
        console.log(
          `[findFilesWithGlob] path.posix.relative returned absolute, using manual calculation: ${relativePath} (from ${fileUri}, base length: ${normalizedBasePath.length})`
        );
      } else if (fileUriLower === basePathLower) {
        // File is the workspace root itself
        relativePath = '.';
        console.log('[findFilesWithGlob] File is workspace root, relativePath set to "."');
      } else {
        // Should not happen given the startsWith check above, but skip to be safe
        console.log(
          `[findFilesWithGlob] WARNING: startsWith passed but manual relative path calculation failed for: ${fileUri} (base: ${normalizedBasePath}, baseWithSlash: ${basePathWithSlash})`
        );
        continue;
      }
    }

    // Check if file matches any of the patterns
    const matchesRelative = regexes.some(regex => regex.test(relativePath));
    const matchesAbsolute = regexes.some(regex => regex.test(fileUri));
    const matches = matchesRelative || matchesAbsolute;

    if (matches) {
      filesMatched++;
      if (filesMatched <= 5) {
        // Log first 5 matched files for debugging
        console.log(
          `[findFilesWithGlob] MATCHED: ${fileUri} (relative: ${relativePath}, matchesRelative: ${matchesRelative}, matchesAbsolute: ${matchesAbsolute})`
        );
        // Log which specific pattern matched
        for (let i = 0; i < regexes.length; i++) {
          if (regexes[i].test(relativePath) || regexes[i].test(fileUri)) {
            console.log(`[findFilesWithGlob] Matched pattern ${i}: ${patterns[i]}`);
          }
        }
      }
      const fileStat = fileSystemProvider.getFileStat(fileUri);
      results.push({
        path: fileUri,
        stats: fileStat
          ? {
              mtime: new Date(fileStat.mtime)
            }
          : undefined
      });
    } else if (filesInWorkspace <= 10) {
      // Log first 10 files in workspace that didn't match (for debugging)
      console.log(`[findFilesWithGlob] IN WORKSPACE BUT NO MATCH: ${fileUri} (relative: ${relativePath})`);
      // Log why it didn't match - test each pattern
      for (let i = 0; i < regexes.length; i++) {
        const relativeMatch = regexes[i].test(relativePath);
        const absoluteMatch = regexes[i].test(fileUri);
        if (!relativeMatch && !absoluteMatch) {
          console.log(
            `[findFilesWithGlob] Pattern ${i} (${patterns[i]}) did not match relative (${relativePath}) or absolute (${fileUri})`
          );
        }
      }
    }
  }

  console.log(
    `[findFilesWithGlob] Summary: total=${allFileUris.length}, inWorkspace=${filesInWorkspace}, filteredByStartsWith=${filesFilteredByStartsWith}, matched=${filesMatched}, results=${results.length}`
  );

  return results;
};

export default class ComponentIndexer {
  public readonly workspaceRoot: string;
  public workspaceType: WorkspaceType = 'UNKNOWN';
  public readonly tags: Map<string, Tag> = new Map();
  public readonly fileSystemProvider: IFileSystemProvider;

  constructor(private readonly attributes: ComponentIndexerAttributes) {
    console.log(`[ComponentIndexer.constructor] attributes.workspaceRoot: ${attributes.workspaceRoot}`);
    this.workspaceRoot = getWorkspaceRoot(attributes.workspaceRoot);
    console.log(`[ComponentIndexer.constructor] normalized workspaceRoot: ${this.workspaceRoot}`);
    this.fileSystemProvider = attributes.fileSystemProvider;
    const allFileUris = this.fileSystemProvider.getAllFileUris();
    const totalFiles = allFileUris.length;
    console.log(`[ComponentIndexer.constructor] fileSystemProvider has ${totalFiles} files`);
    if (totalFiles > 0 && totalFiles <= 20) {
      // Log all file URIs if there are 20 or fewer (for debugging small test cases)
      console.log(`[ComponentIndexer.constructor] sample file URIs (first 20): ${allFileUris.slice(0, 20).join(', ')}`);
    } else if (totalFiles > 20) {
      // Log first 10 and last 10 if there are many files
      console.log(`[ComponentIndexer.constructor] sample file URIs (first 10): ${allFileUris.slice(0, 10).join(', ')}`);
      console.log(`[ComponentIndexer.constructor] sample file URIs (last 10): ${allFileUris.slice(-10).join(', ')}`);
    }
  }

  private async getSfdxPackageDirsPattern(): Promise<string> {
    const pattern = await getSfdxPackageDirsPattern(this.attributes.workspaceRoot, this.fileSystemProvider);
    console.log(`[ComponentIndexer.getSfdxPackageDirsPattern] pattern: ${pattern}`);
    return pattern;
  }

  // visible for testing
  public async getComponentEntries(): Promise<Entry[]> {
    let files: Entry[] = [];

    console.log(`[ComponentIndexer.getComponentEntries] workspaceType: ${this.workspaceType}`);
    console.log(`[ComponentIndexer.getComponentEntries] workspaceRoot: ${this.workspaceRoot}`);

    switch (this.workspaceType) {
      case 'SFDX':
        // workspaceRoot is already normalized by getWorkspaceRoot()
        const packageDirsPattern = await this.getSfdxPackageDirsPattern();
        // Pattern matches: {packageDir}/**/*/lwc/**/*.js
        // The **/* before lwc requires at least one directory level (e.g., main/default/lwc or meta/lwc)
        const sfdxPattern = `${packageDirsPattern}/**/*/lwc/**/*.js`;
        console.log(`[ComponentIndexer.getComponentEntries] SFDX pattern: ${sfdxPattern}`);
        console.log(`[ComponentIndexer.getComponentEntries] packageDirsPattern: ${packageDirsPattern}`);
        files = await findFilesWithGlob(sfdxPattern, this.fileSystemProvider, this.workspaceRoot);
        console.log(`[ComponentIndexer.getComponentEntries] Found ${files.length} files before filtering`);
        if (files.length > 0 && files.length <= 10) {
          console.log(
            `[ComponentIndexer.getComponentEntries] Files before filtering: ${files.map(f => f.path).join(', ')}`
          );
        }
        const filteredFiles = files.filter((item: Entry): boolean => {
          const data = path.parse(item.path);
          const dirEndsWithName = data.dir.endsWith(data.name);
          // Log detailed comparison for debugging path issues
          if (files.length <= 10) {
            const dirLower = data.dir.toLowerCase();
            const nameLower = data.name.toLowerCase();
            const dirEndsWithNameCaseInsensitive = dirLower.endsWith(nameLower);
            console.log(
              `[ComponentIndexer.getComponentEntries] Checking: ${item.path} | dir: "${data.dir}" (len: ${data.dir.length}) | name: "${data.name}" (len: ${data.name.length}) | endsWith (case-sensitive): ${dirEndsWithName} | endsWith (case-insensitive): ${dirEndsWithNameCaseInsensitive}`
            );
          }
          if (!dirEndsWithName && files.length <= 10) {
            // Log first 10 filtered files for debugging
            console.log(
              `[ComponentIndexer.getComponentEntries] FILTERED (dir doesn't end with name): ${item.path} (dir: ${data.dir}, name: ${data.name})`
            );
          } else if (dirEndsWithName && files.length <= 10) {
            // Log files that pass the filter
            console.log(
              `[ComponentIndexer.getComponentEntries] PASSED (dir ends with name): ${item.path} (dir: ${data.dir}, name: ${data.name})`
            );
          }
          return dirEndsWithName;
        });
        console.log(`[ComponentIndexer.getComponentEntries] Found ${filteredFiles.length} files after filtering`);
        if (filteredFiles.length > 0 && filteredFiles.length <= 10) {
          console.log(
            `[ComponentIndexer.getComponentEntries] Files after filtering: ${filteredFiles.map(f => f.path).join(', ')}`
          );
        }
        return filteredFiles;
      default:
        // For CORE_ALL and CORE_PARTIAL
        // workspaceRoot is already normalized by getWorkspaceRoot()
        const defaultPattern = '**/*/modules/**/*.js';
        console.log(`[ComponentIndexer.getComponentEntries] CORE pattern: ${defaultPattern}`);
        files = await findFilesWithGlob(defaultPattern, this.fileSystemProvider, this.workspaceRoot);
        console.log(`[ComponentIndexer.getComponentEntries] Found ${files.length} files before filtering`);
        if (files.length > 0 && files.length <= 10) {
          console.log(
            `[ComponentIndexer.getComponentEntries] Files before filtering: ${files.map(f => f.path).join(', ')}`
          );
        }
        const filteredFilesDefault = files.filter((item: Entry): boolean => {
          const data = path.parse(item.path);
          const dirEndsWithName = data.dir.endsWith(data.name);
          if (!dirEndsWithName && files.length <= 10) {
            // Log first 10 filtered files for debugging
            console.log(
              `[ComponentIndexer.getComponentEntries] FILTERED (dir doesn't end with name): ${item.path} (dir: ${data.dir}, name: ${data.name})`
            );
          } else if (dirEndsWithName && files.length <= 10) {
            // Log files that pass the filter
            console.log(
              `[ComponentIndexer.getComponentEntries] PASSED (dir ends with name): ${item.path} (dir: ${data.dir}, name: ${data.name})`
            );
          }
          return dirEndsWithName;
        });
        console.log(
          `[ComponentIndexer.getComponentEntries] Found ${filteredFilesDefault.length} files after filtering`
        );
        if (filteredFilesDefault.length > 0 && filteredFilesDefault.length <= 10) {
          console.log(
            `[ComponentIndexer.getComponentEntries] Files after filtering: ${filteredFilesDefault.map(f => f.path).join(', ')}`
          );
        }
        return filteredFilesDefault;
    }
  }

  public getCustomData(): Tag[] {
    const tags = Array.from(this.tags.values());
    console.log(`[ComponentIndexer.getCustomData] Returning ${tags.length} tags`);
    if (tags.length > 0 && tags.length <= 20) {
      console.log(`[ComponentIndexer.getCustomData] Tag names: ${tags.map(tag => getTagName(tag)).join(', ')}`);
    } else if (tags.length > 20) {
      console.log(
        `[ComponentIndexer.getCustomData] First 10 tag names: ${tags
          .slice(0, 10)
          .map(tag => getTagName(tag))
          .join(', ')}`
      );
      console.log(
        `[ComponentIndexer.getCustomData] Last 10 tag names: ${tags
          .slice(-10)
          .map(tag => getTagName(tag))
          .join(', ')}`
      );
    }
    return tags;
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
      const uri = `file://${normalizePath(indexPath)}`;
      console.log(`[ComponentIndexer.loadTagsFromIndex] Checking for index file at: ${uri}`);

      if (this.fileSystemProvider.fileExists(uri)) {
        console.log('[ComponentIndexer.loadTagsFromIndex] Index file exists, loading tags');
        const content = this.fileSystemProvider.getFileContent(uri);
        if (content) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const index: TagAttrs[] = JSON.parse(content);
          console.log(`[ComponentIndexer.loadTagsFromIndex] Found ${index.length} tags in index`);
          for (const data of index) {
            const info = await createTag(data);
            const tagName = getTagName(info);
            this.tags.set(tagName, info);
            console.log(`[ComponentIndexer.loadTagsFromIndex] Loaded tag from index: ${tagName} (file: ${info.file})`);
          }
        } else {
          console.log('[ComponentIndexer.loadTagsFromIndex] Index file exists but has no content');
        }
      } else {
        console.log('[ComponentIndexer.loadTagsFromIndex] Index file does not exist');
      }
    } catch (err) {
      console.error('[ComponentIndexer.loadTagsFromIndex] Error loading tags from index:', err);
    }
  }

  public persistCustomComponents(): void {
    const indexJsonString = JSON.stringify(this.getCustomData());

    // Store the component index data for the client to process
    this.fileSystemProvider.updateFileContent('lwc:componentIndex', indexJsonString);
  }

  public async insertSfdxTsConfigPath(filePaths: string[]): Promise<void> {
    // FileSystemDataProvider.normalizePath() handles all normalization (unixify + drive letter case)
    const sfdxTsConfigPath = `${this.workspaceRoot}/.sfdx/tsconfig.sfdx.json`;

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
        console.error(err);
      }
    }
  }

  // This is a temporary solution to enable automated LWC module resolution for TypeScript modules.
  // It is intended to update the path mapping in the .sfdx/tsconfig.sfdx.json file.
  // TODO: Once the LWC custom module resolution plugin has been developed in the language server
  // this can be removed.
  public async updateSfdxTsConfigPath(): Promise<void> {
    // FileSystemDataProvider.normalizePath() handles all normalization (unixify + drive letter case)
    const sfdxTsConfigPath = `${this.workspaceRoot}/.sfdx/tsconfig.sfdx.json`;

    const fileExists = this.fileSystemProvider.fileExists(sfdxTsConfigPath);

    if (fileExists) {
      try {
        const content = this.fileSystemProvider.getFileContent(sfdxTsConfigPath);
        if (content) {
          const sfdxTsConfig: SfdxTsConfig = JSON.parse(content);
          // The assumption here is that sfdxTsConfig will not be modified by the user as
          // it is located in the .sfdx directory.
          sfdxTsConfig.compilerOptions = sfdxTsConfig.compilerOptions ?? { paths: {} };
          sfdxTsConfig.compilerOptions.paths = await this.getTsConfigPathMapping();

          // Update the actual tsconfig file
          this.fileSystemProvider.updateFileContent(sfdxTsConfigPath, JSON.stringify(sfdxTsConfig, null, 2));
        }
      } catch (err) {
        console.error(err);
      }
    }
  }

  // visible for testing
  public async getTsConfigPathMapping(): Promise<TsConfigPaths> {
    const files: TsConfigPaths = {};
    if (this.workspaceType === 'SFDX') {
      // workspaceRoot is already normalized by getWorkspaceRoot()
      const packageDirsPattern = await this.getSfdxPackageDirsPattern();
      // Use **/* after lwc to match any depth (e.g., utils/meta/lwc/todo_util/todo_util.js)
      const sfdxPattern = `${packageDirsPattern}/**/*/lwc/**/*.{js,ts}`;
      const filePaths = await findFilesWithGlob(sfdxPattern, this.fileSystemProvider, this.workspaceRoot);
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

  private async getUnIndexedFiles(): Promise<Entry[]> {
    const componentEntries = await this.getComponentEntries();
    const customData = this.getCustomData();
    console.log(
      `[ComponentIndexer.getUnIndexedFiles] componentEntries: ${componentEntries.length}, existing tags: ${customData.length}`
    );
    const unIndexed = unIndexedFiles(componentEntries, customData);
    console.log(`[ComponentIndexer.getUnIndexedFiles] unIndexed files: ${unIndexed.length}`);
    if (unIndexed.length > 0 && unIndexed.length <= 10) {
      console.log(
        `[ComponentIndexer.getUnIndexedFiles] unIndexed file paths: ${unIndexed.map(e => e.path).join(', ')}`
      );
    }
    return unIndexed;
  }

  public async getStaleTags(): Promise<Tag[]> {
    const componentEntries = await this.getComponentEntries();

    return this.getCustomData().filter(tag => !componentEntries.some(entry => entry.path === tag.file));
  }

  public async init(): Promise<void> {
    console.log(`[ComponentIndexer.init] Starting initialization for workspaceRoot: ${this.attributes.workspaceRoot}`);
    console.log(`[ComponentIndexer.init] Normalized workspaceRoot: ${this.workspaceRoot}`);
    console.log(
      `[ComponentIndexer.init] fileSystemProvider has ${this.fileSystemProvider.getAllFileUris().length} files before workspace type detection`
    );
    this.workspaceType = await detectWorkspaceHelper(this.attributes.workspaceRoot, this.fileSystemProvider);
    console.log(`[ComponentIndexer.init] Detected workspaceType: ${this.workspaceType}`);

    await this.loadTagsFromIndex();
    console.log(`[ComponentIndexer.init] Loaded ${this.tags.size} tags from index`);

    const unIndexedFilesResult = await this.getUnIndexedFiles();
    console.log(`[ComponentIndexer.init] Processing ${unIndexedFilesResult.length} unindexed files`);

    console.log(
      `[ComponentIndexer.init] Processing ${unIndexedFilesResult.length} unindexed files: ${unIndexedFilesResult.map(e => e.path).join(', ')}`
    );
    console.log(`[ComponentIndexer.init] About to create tags from ${unIndexedFilesResult.length} files`);
    const promises = unIndexedFilesResult.map(async (entry, index) => {
      console.log(
        `[ComponentIndexer.init] Creating tag ${index + 1}/${unIndexedFilesResult.length} from file: ${entry.path}`
      );
      const tag = await createTagFromFile(entry.path, this.fileSystemProvider, entry.stats?.mtime);
      if (tag) {
        console.log(
          `[ComponentIndexer.init] Successfully created tag ${index + 1}/${unIndexedFilesResult.length}: ${getTagName(tag)}`
        );
      } else {
        console.log(
          `[ComponentIndexer.init] Failed to create tag ${index + 1}/${unIndexedFilesResult.length} from file: ${entry.path}`
        );
      }
      return tag;
    });
    const tags = await Promise.all(promises);

    // Log which files succeeded and which failed
    const validTags: Tag[] = [];
    const failedFiles: string[] = [];
    tags.forEach((tag, index) => {
      if (tag) {
        validTags.push(tag);
      } else {
        failedFiles.push(unIndexedFilesResult[index].path);
      }
    });
    console.log(
      `[ComponentIndexer.init] Created ${validTags.length} tags from ${unIndexedFilesResult.length} unindexed files`
    );
    if (failedFiles.length > 0) {
      console.log(
        `[ComponentIndexer.init] Failed to create tags from ${failedFiles.length} files: ${failedFiles.join(', ')}`
      );
    }
    if (validTags.length > 0) {
      console.log(`[ComponentIndexer.init] Valid tag names: ${validTags.map(tag => getTagName(tag)).join(', ')}`);
    }
    validTags.forEach(tag => {
      const tagName = getTagName(tag);
      this.tags.set(tagName, tag);
      console.log(`[ComponentIndexer.init] Added tag to map: ${tagName} (file: ${tag.file})`);
    });

    const staleTags = await this.getStaleTags();
    console.log(`[ComponentIndexer.init] Found ${staleTags.length} stale tags to remove`);
    staleTags.forEach(tag => {
      if (tag) {
        this.tags.delete(getTagName(tag));
      }
    });

    this.persistCustomComponents();
    console.log(`[ComponentIndexer.init] Initialization complete. Total tags: ${this.tags.size}`);
  }
}
