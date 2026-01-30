/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { nls } from './messages';
import { FileSystemDataProvider, IFileSystemProvider } from './providers/fileSystemDataProvider';
import { jsconfigCore } from './resources/core/jsconfig-core';
import { settingsCore } from './resources/core/settings-core';
import { jsconfigSfdx } from './resources/sfdx/jsconfig-sfdx';
import { WorkspaceType, getSfdxProjectFile } from './shared';
import * as utils from './utils';
import { NormalizedPath } from './utils';

export const AURA_EXTENSIONS: string[] = ['.cmp', '.app', '.design', '.evt', '.intf', '.auradoc', '.tokens'];

interface SfdxPackageDirectoryConfig {
  path: string;
}

interface SfdxProjectConfig {
  packageDirectories: SfdxPackageDirectoryConfig[];
  sfdxPackageDirsPattern: string;
}

export interface Indexer {
  configureAndIndex(): Promise<void>;
  resetIndex(): void;
}

const isSfdxPackageDirectoryConfig = (value: unknown): value is SfdxPackageDirectoryConfig => {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value;
  return 'path' in obj && typeof obj.path === 'string';
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const readSfdxProjectConfig = (root: string, fileSystemProvider: IFileSystemProvider): SfdxProjectConfig => {
  const configPath = getSfdxProjectFile(root);
  const configText = fileSystemProvider.getFileContent(configPath);

  if (!configText) {
    throw new Error(nls.localize('config_file_not_found_message'));
  }

  try {
    const config: unknown = JSON.parse(configText);
    if (!isRecord(config)) {
      throw new Error(nls.localize('invalid_config_format_message'));
    }
    const packageDirectories = Array.isArray(config.packageDirectories)
      ? config.packageDirectories.filter(isSfdxPackageDirectoryConfig)
      : [];
    const sfdxPackageDirsPattern = packageDirectories.map((pkg: SfdxPackageDirectoryConfig) => pkg.path).join(',');
    return {
      ...config,
      packageDirectories,
      sfdxPackageDirsPattern: `{${sfdxPackageDirsPattern}}`
    };
  } catch (e) {
    // JSON parsing errors are real problems - throw them
    const errorMessage = e instanceof Error ? e.message : String(e);
    throw new Error(nls.localize('sfdx_project_file_invalid_message', configPath, errorMessage));
  }
};

const updateConfigFile =
  (fileSystemProvider: IFileSystemProvider) =>
  (filePath: string, content: string): void => {
    const dir = path.dirname(filePath);
    fileSystemProvider.updateDirectoryListing(dir, []);
    // updateFileContent is now async, but this function is synchronous
    // Since this is used in contexts without connection, the promise resolves immediately
    void fileSystemProvider.updateFileContent(filePath, content);
  };

const getCoreSettings = (workspaceRoots: string[]): Record<string, unknown> =>
  // Merge template settings with provided settings
  ({
    ...settingsCore,
    // Update eslint settings
    'eslint.workingDirectories': workspaceRoots,
    'eslint.validate': ['javascript', 'typescript'],
    'eslint.options': {
      overrideConfigFile: path.join(workspaceRoots[0], '.eslintrc.json')
    },
    // Set perforce settings with default values
    'perforce.client': 'username-localhost-blt',
    'perforce.user': 'username',
    'perforce.port': 'ssl:host:port'
  });

export const updateForceIgnoreFile = (
  forceignorePath: string,
  addTsConfig: boolean,
  fileSystemProvider: IFileSystemProvider
): void => {
  let forceignoreContent = '';
  try {
    const data = fileSystemProvider.getFileContent(forceignorePath);
    if (!data) {
      throw new Error(nls.localize('forceignore_file_not_found_message'));
    }
    forceignoreContent = Buffer.from(data).toString('utf8');
  } catch {
    // File doesn't exist, start with empty content
  }

  // Add standard forceignore patterns for JavaScript projects
  if (!forceignoreContent.includes('**/jsconfig.json')) {
    forceignoreContent += '\n**/jsconfig.json';
  }
  if (!forceignoreContent.includes('**/.eslintrc.json')) {
    forceignoreContent += '\n**/.eslintrc.json';
  }

  if (addTsConfig && !forceignoreContent.includes('**/tsconfig.json')) {
    forceignoreContent += '\n**/tsconfig.json';
  }

  if (addTsConfig && !forceignoreContent.includes('**/*.ts')) {
    forceignoreContent += '\n**/*.ts';
  }

  // Always write the forceignore file, even if it's empty
  void fileSystemProvider.updateFileContent(forceignorePath, forceignoreContent.trim());
};

export const getModulesDirs = (
  workspaceType: WorkspaceType,
  workspaceRoots: string[],
  fileSystemProvider: IFileSystemProvider,
  getSfdxProjectConfig: () => SfdxProjectConfig
): NormalizedPath[] => {
  // Normalize workspaceRoots at the start to ensure consistent path format
  // This ensures all path operations use normalized paths
  const normalizedWorkspaceRoots = workspaceRoots.map(root => utils.normalizePath(root));
  const modulesDirs: NormalizedPath[] = [];
  switch (workspaceType) {
    case 'SFDX':
      const { packageDirectories } = getSfdxProjectConfig();
      for (const pkg of packageDirectories) {
        // Check both new SFDX structure (main/default) and old structure (meta)
        const newPkgDir = path.join(normalizedWorkspaceRoots[0], pkg.path, 'main', 'default');
        const oldPkgDir = path.join(normalizedWorkspaceRoots[0], pkg.path, 'meta');

        // Check for LWC components in new structure
        const newLwcDir = utils.normalizePath(path.join(newPkgDir, 'lwc'));
        const newLwcDirStat = fileSystemProvider.getFileStat(newLwcDir);
        if (newLwcDirStat?.type === 'directory') {
          // Add the LWC directory itself, not individual components
          modulesDirs.push(newLwcDir);
        } else {
          // New structure doesn't exist, check for LWC components in old structure
          const oldLwcDir = utils.normalizePath(path.join(oldPkgDir, 'lwc'));
          const oldLwcDirStat = fileSystemProvider.getFileStat(oldLwcDir);
          if (oldLwcDirStat?.type === 'directory') {
            modulesDirs.push(oldLwcDir);
          }
        }

        // Note: Aura directories are not included in modulesDirs as they don't typically use TypeScript
        // and this method is primarily used for TypeScript configuration
      }
      break;
    case 'CORE_ALL':
      // For CORE_ALL, return the modules directories for each project
      const projects = fileSystemProvider.getDirectoryListing(normalizedWorkspaceRoots[0]);
      for (const project of projects) {
        // Use path.join instead of path.resolve since normalizedWorkspaceRoots[0] is already absolute
        // This prevents path.resolve from potentially duplicating path segments on Windows
        const modulesDir = path.join(normalizedWorkspaceRoots[0], project.name, 'modules');
        let pathExists = false;
        try {
          const fileStat = fileSystemProvider.getFileStat(modulesDir);
          if (fileStat?.type === 'directory') {
            pathExists = true;
          }
        } catch {
          // path doesn't exist, skip
        }
        if (pathExists) {
          // Normalize path to ensure consistent format (especially Windows drive letter casing)
          modulesDirs.push(utils.normalizePath(modulesDir));
        }
      }
      break;
    case 'CORE_PARTIAL':
      // For CORE_PARTIAL, return the modules directory for each workspace root
      for (const ws of normalizedWorkspaceRoots) {
        const modulesDir = path.join(ws, 'modules');
        let pathExists = false;
        try {
          const fileStat = fileSystemProvider.getFileStat(modulesDir);
          if (fileStat?.type === 'directory') {
            pathExists = true;
          }
        } catch {
          // path doesn't exist, skip
        }
        if (pathExists) {
          // Normalize path to ensure consistent format (especially Windows drive letter casing)
          modulesDirs.push(utils.normalizePath(modulesDir));
        }
      }
      break;
    case 'STANDARD':
    case 'STANDARD_LWC':
    case 'MONOREPO':
    case 'UNKNOWN':
      // For standard workspaces, return empty array as they don't have modules directories
      break;
  }
  return modulesDirs;
};

/**
 * Holds information and utility methods for a workspace
 */
export abstract class BaseWorkspaceContext {
  public type!: WorkspaceType;
  public workspaceRoots: NormalizedPath[];

  protected findNamespaceRootsUsingTypeCache: () => Promise<{ lwc: string[]; aura: string[] }>;
  public initSfdxProjectConfigCache: () => SfdxProjectConfig;
  public fileSystemProvider: FileSystemDataProvider;
  /**
   * @param workspaceRoots
   * @return BaseWorkspaceContext representing the workspace with workspaceRoots
   */
  constructor(workspaceRoots: NormalizedPath[] | NormalizedPath, fileSystemProvider: FileSystemDataProvider) {
    // Normalize workspaceRoots to ensure consistent path format (especially Windows drive letter casing)
    this.workspaceRoots = Array.isArray(workspaceRoots) ? workspaceRoots : [workspaceRoots];

    this.findNamespaceRootsUsingTypeCache = utils.memoize(() => this.findNamespaceRootsUsingType());
    this.initSfdxProjectConfigCache = utils.memoize(() => this.initSfdxProject());
    this.fileSystemProvider = fileSystemProvider;
  }

  /**
   * Initialize the workspace context asynchronously
   */
  public initialize(workspaceType: WorkspaceType): void {
    this.type = workspaceType;
    if (this.type === 'SFDX') {
      void this.initSfdxProjectConfigCache();
    }
  }

  public async isAuraMarkup(document: TextDocument): Promise<boolean> {
    const extension = utils.getExtension(document);
    const isAuraExtension = AURA_EXTENSIONS.includes(extension);
    const languageIdMatches = document.languageId === 'html' || (isAuraExtension && !document.languageId);
    return languageIdMatches && isAuraExtension && (await this.isInsideAuraRoots(document));
  }

  public async isInsideAuraRoots(document: TextDocument): Promise<boolean> {
    // Normalize file path to ensure consistent format (especially Windows drive letter casing and path separators)
    const file = utils.normalizePath(utils.toResolvedPath(document.uri));
    for (const ws of this.workspaceRoots) {
      if (utils.pathStartsWith(file, ws)) {
        return await this.isFileInsideAuraRoots(file);
      }
    }
    return false;
  }

  public async isFileInsideModulesRoots(file: string): Promise<boolean> {
    // Normalize file path to ensure consistent format (especially Windows drive letter casing and path separators)
    const normalizedFile = utils.normalizePath(file);
    const namespaceRoots = await this.findNamespaceRootsUsingTypeCache();
    return namespaceRoots.lwc.some(root => utils.pathStartsWith(normalizedFile, root));
  }

  public async isFileInsideAuraRoots(file: string): Promise<boolean> {
    // Normalize file path to ensure consistent format (especially Windows drive letter casing and path separators)
    const normalizedFile = utils.normalizePath(file);
    return (await this.findNamespaceRootsUsingTypeCache()).aura.some(root =>
      utils.pathStartsWith(normalizedFile, root)
    );
  }

  /**
   * @returns string list of all lwc and aura namespace roots
   */
  protected abstract findNamespaceRootsUsingType(): Promise<{ lwc: string[]; aura: string[] }>;

  /**
   * Configures the project
   */
  public configureProject(): void {
    this.writeSettingsJson();
    this.writeCodeWorkspace();
    this.writeJsconfigJson();
    this.writeTypings();
  }

  private writeSettingsJson(): void {
    const settingsPath = path.join(this.workspaceRoots[0], '.vscode', 'settings.json');
    const settings = getCoreSettings(this.workspaceRoots);
    updateConfigFile(this.fileSystemProvider)(settingsPath, JSON.stringify(settings, null, 2));
  }

  private writeCodeWorkspace(): void {
    const workspacePath = path.join(this.workspaceRoots[0], 'core.code-workspace');
    const workspace = getCodeWorkspace(this.workspaceRoots);
    updateConfigFile(this.fileSystemProvider)(workspacePath, JSON.stringify(workspace, null, 2));
  }

  private writeJsconfigJson(): void {
    switch (this.type) {
      case 'SFDX':
        this.writeSfdxJsconfig();
        break;
      case 'CORE_ALL':
      case 'CORE_PARTIAL':
        this.writeCoreJsconfig();
        break;
      default:
        // No jsconfig needed for other workspace types
        break;
    }
  }

  private writeSfdxJsconfig(): void {
    const modulesDirs = getModulesDirs(this.type, this.workspaceRoots, this.fileSystemProvider, () =>
      this.initSfdxProjectConfigCache()
    );

    for (const modulesDir of modulesDirs) {
      const jsconfigPath = path.join(modulesDir, 'jsconfig.json');

      // Skip if tsconfig.json already exists
      const tsconfigPath = path.join(modulesDir, 'tsconfig.json');
      try {
        const fileStat = this.fileSystemProvider.getFileStat(tsconfigPath);
        if (fileStat?.type === 'file' && fileStat?.exists === true) {
          continue;
        }
      } catch {
        // tsconfig.json doesn't exist, continue with jsconfig creation
      }

      try {
        let jsconfigContent: string;

        // If jsconfig already exists, read and update it
        let jsconfigExists = false;
        try {
          const fileStat = this.fileSystemProvider.getFileStat(jsconfigPath);
          if (fileStat?.type === 'file' && fileStat?.exists === true) {
            jsconfigExists = true;
          }
        } catch {
          // jsconfig.json doesn't exist
        }

        if (jsconfigExists) {
          const existingConfigContent = this.fileSystemProvider.getFileContent(jsconfigPath);
          if (!existingConfigContent) {
            throw new Error(nls.localize('existing_config_content_not_found_message'));
          }
          const existingConfig: unknown = JSON.parse(existingConfigContent);
          if (!isRecord(existingConfig)) {
            throw new Error(nls.localize('invalid_existing_config_format_message'));
          }

          // Merge existing config with template config
          if (!this.workspaceRoots[0]) {
            throw new Error(
              nls.localize(
                'workspaceRoots_0_required_message',
                this.workspaceRoots?.[0] ?? 'undefined',
                String(this.workspaceRoots?.[0] === undefined)
              )
            );
          }
          const relativeWorkspaceRoot = utils.relativePath(path.dirname(jsconfigPath), this.workspaceRoots[0]) || '.';
          const typingsInclude = `${relativeWorkspaceRoot}/.sfdx/typings/lwc/**/*.d.ts`;

          const existingInclude = existingConfig.include;
          const existingCompilerOptions = existingConfig.compilerOptions;
          const templateCompilerOptions = jsconfigSfdx.compilerOptions;

          const mergedConfig = {
            ...existingConfig,
            ...jsconfigSfdx,
            compilerOptions: {
              ...(isRecord(existingCompilerOptions) ? existingCompilerOptions : {}),
              ...(isRecord(templateCompilerOptions) ? templateCompilerOptions : {})
            },
            include: [
              ...(Array.isArray(existingInclude)
                ? existingInclude.filter((item): item is string => typeof item === 'string')
                : []),
              ...jsconfigSfdx.include,
              typingsInclude
            ]
          };

          jsconfigContent = JSON.stringify(mergedConfig, null, 4);
        } else {
          // Create new jsconfig from template
          if (this.workspaceRoots?.length === 0 || !this.workspaceRoots[0]) {
            throw new Error(
              nls.localize(
                'workspaceRoots_0_required_message',
                this.workspaceRoots?.[0] ?? 'undefined',
                String(this.workspaceRoots?.[0] === undefined)
              )
            );
          }
          const fromPath = path.dirname(jsconfigPath);
          const toPath = this.workspaceRoots[0];
          if (!fromPath || !toPath) {
            throw new Error(nls.localize('invalid_paths_message', fromPath, toPath));
          }
          const relativeWorkspaceRoot = utils.relativePath(fromPath, toPath) || '.';
          const typingsInclude = `${relativeWorkspaceRoot}/.sfdx/typings/lwc/**/*.d.ts`;
          const config = {
            ...jsconfigSfdx,
            include: [...jsconfigSfdx.include, typingsInclude]
          };
          jsconfigContent = JSON.stringify(config, null, 2);
        }

        updateConfigFile(this.fileSystemProvider)(jsconfigPath, jsconfigContent);
      } catch (error) {
        console.error(
          `writeSfdxJsconfig: Error reading/writing jsconfig: ${error instanceof Error ? error.message : String(error)}`
        );
        if (error instanceof Error) {
          console.error(`Stack: ${error.stack}`);
        }
        throw error;
      }
    }

    // Update forceignore
    const forceignorePath = path.join(this.workspaceRoots[0], '.forceignore');
    updateForceIgnoreFile(forceignorePath, false, this.fileSystemProvider);
  }

  private writeCoreJsconfig(): void {
    const modulesDirs = getModulesDirs(this.type, this.workspaceRoots, this.fileSystemProvider, () =>
      this.initSfdxProjectConfigCache()
    );

    for (const modulesDir of modulesDirs) {
      const jsconfigPath = path.join(modulesDir, 'jsconfig.json');

      // Skip if tsconfig.json already exists
      const tsconfigPath = path.join(modulesDir, 'tsconfig.json');
      const fileStat = this.fileSystemProvider.getFileStat(tsconfigPath);
      if (fileStat?.type === 'file' && fileStat?.exists === true) {
        // Remove tsconfig.json if it exists (as per test expectation)
        this.fileSystemProvider.updateDirectoryListing(tsconfigPath, []);
      }

      try {
        // For core workspaces, the typings are in the core directory, not the project directory
        // Calculate relative path from modules directory to the core directory
        const coreDir = this.type === 'CORE_ALL' ? this.workspaceRoots[0] : path.dirname(this.workspaceRoots[0]);
        const relativeCoreRoot = utils.relativePath(modulesDir, coreDir);
        const typingsInclude = `${relativeCoreRoot}/.vscode/typings/lwc/**/*.d.ts`;
        const config = {
          ...jsconfigCore,
          include: [...jsconfigCore.include, typingsInclude]
        };
        const jsconfigContent = JSON.stringify(config, null, 2);
        updateConfigFile(this.fileSystemProvider)(jsconfigPath, jsconfigContent);
      } catch (error) {
        console.error('writeCoreJsconfig: Error reading/writing jsconfig:', error);
        throw error;
      }
    }
  }

  private writeTypings(): void {
    const typingsDir = getTypingsDir(this.type, this.workspaceRoots);
    if (!typingsDir) {
      return;
    }
    // TODO should we just be copying every file in this directory rather than hardcoding?
    // copy typings to typingsDir
    const resourceTypingsDir = utils.getSfdxResource('typings');
    this.fileSystemProvider.updateDirectoryListing(typingsDir, []);
    try {
      const sourcePath = path.join(resourceTypingsDir, 'lds.d.ts');
      const destPath = path.join(typingsDir, 'lds.d.ts');
      const content = this.fileSystemProvider.getFileContent(sourcePath);
      if (content) {
        void this.fileSystemProvider.updateFileContent(destPath, content);
      }
    } catch {
      // ignore
    }
    try {
      const sourcePath = path.join(resourceTypingsDir, 'messageservice.d.ts');
      const destPath = path.join(typingsDir, 'messageservice.d.ts');
      const content = this.fileSystemProvider.getFileContent(sourcePath);
      if (content) {
        void this.fileSystemProvider.updateFileContent(destPath, content);
      }
    } catch {
      // ignore
    }
    const dirs = this.fileSystemProvider.getDirectoryListing(
      utils.normalizePath(path.join(resourceTypingsDir, 'copied'))
    );
    for (const file of dirs) {
      try {
        const sourcePath = path.join(resourceTypingsDir, 'copied', file.name);
        const destPath = path.join(typingsDir, file.name);
        const content = this.fileSystemProvider.getFileContent(sourcePath);
        if (content) {
          void this.fileSystemProvider.updateFileContent(destPath, content);
        }
      } catch {
        // ignore
      }
    }
  }

  private initSfdxProject(): SfdxProjectConfig {
    return readSfdxProjectConfig(this.workspaceRoots[0], this.fileSystemProvider);
  }
}

const getTypingsDir = (type: WorkspaceType, workspaceRoots: string[]): string | undefined => {
  switch (type) {
    case 'SFDX':
      return path.join(workspaceRoots[0], '.sfdx', 'typings', 'lwc');
    case 'CORE_PARTIAL':
      return path.join(workspaceRoots[0], '..', '.vscode', 'typings', 'lwc');
    case 'CORE_ALL':
      return path.join(workspaceRoots[0], '.vscode', 'typings', 'lwc');
  }
};
const getCodeWorkspace = (workspaceRoots: string[]): Record<string, unknown> => ({
  folders: workspaceRoots.map(root => ({ path: root })),
  settings: {
    'eslint.workingDirectories': workspaceRoots,
    'eslint.validate': ['javascript', 'typescript'],
    'eslint.options': {
      overrideConfigFile: path.join(workspaceRoots[0], '.eslintrc.json')
    }
  }
});
