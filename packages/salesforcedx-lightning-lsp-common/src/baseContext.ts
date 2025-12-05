/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as ejs from 'ejs';
import * as path from 'node:path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { FileSystemDataProvider, IFileSystemProvider } from './providers/fileSystemDataProvider';
import * as jsconfigCoreTemplateJson from './resources/core/jsconfig-core.json';
import * as settingsCoreTemplateJson from './resources/core/settings-core.json';
import * as jsconfigSfdxTemplateJson from './resources/sfdx/jsconfig-sfdx.json';
import { WorkspaceType, detectWorkspaceType, getSfdxProjectFile } from './shared';
import * as utils from './utils';
import { NormalizedPath } from './utils';

// Handle namespace JSON imports - extract actual JSON content (may be in .default or directly on namespace)
const jsconfigCoreTemplate = utils.extractJsonFromImport(jsconfigCoreTemplateJson);
const settingsCoreTemplate = utils.extractJsonFromImport(settingsCoreTemplateJson);
const jsconfigSfdxTemplate = utils.extractJsonFromImport(jsconfigSfdxTemplateJson);

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
  try {
    const configText = fileSystemProvider.getFileContent(getSfdxProjectFile(root));
    if (!configText) {
      throw new Error('Config file not found');
    }
    const config: unknown = JSON.parse(configText);
    if (!isRecord(config)) {
      throw new Error('Invalid config format');
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
    const errorMessage = e instanceof Error ? e.message : String(e);
    throw new Error(`Sfdx project file seems invalid. Unable to parse ${getSfdxProjectFile(root)}. ${errorMessage}`);
  }
};

const updateConfigFile = (filePath: string, content: string, fileSystemProvider: IFileSystemProvider): void => {
  const dir = path.dirname(filePath);
  fileSystemProvider.updateDirectoryListing(dir, []);
  fileSystemProvider.updateFileContent(filePath, content);
};

export const updateForceIgnoreFile = (
  forceignorePath: string,
  addTsConfig: boolean,
  fileSystemProvider: IFileSystemProvider
): void => {
  let forceignoreContent = '';
  try {
    const data = fileSystemProvider.getFileContent(forceignorePath);
    if (!data) {
      throw new Error('Forceignore file not found');
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
  fileSystemProvider.updateFileContent(forceignorePath, forceignoreContent.trim());
};

// exported for testing
export const processTemplate = (template: string, data: Record<string, unknown>): string => ejs.render(template, data);

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
  public async initialize(): Promise<void> {
    this.type = await detectWorkspaceType(this.workspaceRoots, this.fileSystemProvider);
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
        const isInsideAuraRoots = await this.isFileInsideAuraRoots(file);
        return isInsideAuraRoots;
      }
    }
    return false;
  }

  public async isFileInsideModulesRoots(file: string): Promise<boolean> {
    // Normalize file path to ensure consistent format (especially Windows drive letter casing and path separators)
    const normalizedFile = utils.normalizePath(file);
    return (await this.findNamespaceRootsUsingTypeCache()).lwc.some(root => utils.pathStartsWith(normalizedFile, root));
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
    this.writeSettings();
    this.writeJsconfigJson();
    this.writeTypings();
  }

  private writeSettings(): void {
    this.writeSettingsJson();
    this.writeCodeWorkspace();
  }

  private writeSettingsJson(): void {
    const settingsPath = path.join(this.workspaceRoots[0], '.vscode', 'settings.json');
    const settings = this.getSettings();
    updateConfigFile(settingsPath, JSON.stringify(settings, null, 2), this.fileSystemProvider);
  }

  private writeCodeWorkspace(): void {
    const workspacePath = path.join(this.workspaceRoots[0], 'core.code-workspace');
    const workspace = this.getCodeWorkspace();
    updateConfigFile(workspacePath, JSON.stringify(workspace, null, 2), this.fileSystemProvider);
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
            throw new Error('Existing config content is not found');
          }
          const existingConfig: unknown = JSON.parse(existingConfigContent);
          if (!isRecord(existingConfig)) {
            throw new Error('Invalid existing config format');
          }
          let templateConfig: unknown = jsconfigSfdxTemplate;
          // Double-check extraction - if it's still wrapped, extract again
          if (
            templateConfig &&
            typeof templateConfig === 'object' &&
            !Array.isArray(templateConfig) &&
            'default' in templateConfig &&
            templateConfig.default
          ) {
            templateConfig = templateConfig.default;
          }
          // Ensure it's a record (object, not null, not array)
          if (!isRecord(templateConfig) || Array.isArray(templateConfig)) {
            const errorDetails = {
              templateConfigType: typeof templateConfig,
              templateConfigIsNull: templateConfig === null,
              templateConfigIsUndefined: templateConfig === undefined,
              templateConfigIsArray: Array.isArray(templateConfig),
              templateConfigKeys:
                templateConfig && typeof templateConfig === 'object' ? Object.keys(templateConfig) : [],
              jsconfigSfdxTemplateType: typeof jsconfigSfdxTemplate,
              jsconfigSfdxTemplateKeys:
                jsconfigSfdxTemplate && typeof jsconfigSfdxTemplate === 'object'
                  ? Object.keys(jsconfigSfdxTemplate)
                  : []
            };
            // Use a shorter error message that's less likely to be truncated
            const errorMsg = `Invalid template config (existing): type=${errorDetails.templateConfigType}, isArray=${errorDetails.templateConfigIsArray}, keys=${errorDetails.templateConfigKeys.join(',')}, jsconfigKeys=${errorDetails.jsconfigSfdxTemplateKeys.join(',')}`;
            throw new Error(errorMsg);
          }

          // Merge existing config with template config
          if (!this.workspaceRoots[0]) {
            throw new Error('workspaceRoots[0] is required but was undefined');
          }
          const relativeWorkspaceRoot = utils.relativePath(path.dirname(jsconfigPath), this.workspaceRoots[0]) || '.';
          const templateInclude = templateConfig.include;
          const processedTemplateInclude = Array.isArray(templateInclude)
            ? templateInclude.map((include: unknown) =>
                typeof include === 'string' ? include.replace('<%= project_root %>', relativeWorkspaceRoot) : include
              )
            : [];

          const existingInclude = existingConfig.include;
          const existingCompilerOptions = existingConfig.compilerOptions;
          const templateCompilerOptions = templateConfig.compilerOptions;

          const mergedConfig = {
            ...existingConfig,
            ...templateConfig,
            compilerOptions: {
              ...(isRecord(existingCompilerOptions) ? existingCompilerOptions : {}),
              ...(isRecord(templateCompilerOptions) ? templateCompilerOptions : {})
            },
            include: [
              ...(Array.isArray(existingInclude)
                ? existingInclude.filter((item): item is string => typeof item === 'string')
                : []),
              ...processedTemplateInclude
            ]
          };

          jsconfigContent = JSON.stringify(mergedConfig, null, 4);
        } else {
          // Create new jsconfig from template
          if (this.workspaceRoots?.length === 0 || !this.workspaceRoots[0]) {
            throw new Error(`workspaceRoots[0] is required but was ${this.workspaceRoots?.[0] ?? 'undefined'}`);
          }
          if (!jsconfigSfdxTemplate) {
            throw new Error('jsconfigSfdxTemplate is required but was undefined');
          }
          // Ensure we have a valid object (handle case where extraction might need to happen again)
          let templateToUse = jsconfigSfdxTemplate;
          if (
            templateToUse &&
            typeof templateToUse === 'object' &&
            !Array.isArray(templateToUse) &&
            'default' in templateToUse &&
            templateToUse.default
          ) {
            templateToUse = templateToUse.default;
          }
          // Ensure it's a record (object, not null, not array)
          if (!isRecord(templateToUse) || Array.isArray(templateToUse)) {
            const errorDetails = {
              templateToUseType: typeof templateToUse,
              templateToUseIsNull: templateToUse === null,
              templateToUseIsUndefined: templateToUse === undefined,
              templateToUseIsArray: Array.isArray(templateToUse),
              templateToUseKeys: templateToUse && typeof templateToUse === 'object' ? Object.keys(templateToUse) : [],
              jsconfigSfdxTemplateType: typeof jsconfigSfdxTemplate,
              jsconfigSfdxTemplateKeys:
                jsconfigSfdxTemplate && typeof jsconfigSfdxTemplate === 'object'
                  ? Object.keys(jsconfigSfdxTemplate)
                  : []
            };
            // Use a shorter error message that's less likely to be truncated
            const errorMsg = `Invalid template config (new): type=${errorDetails.templateToUseType}, isArray=${errorDetails.templateToUseIsArray}, keys=${errorDetails.templateToUseKeys.join(',')}, jsconfigKeys=${errorDetails.jsconfigSfdxTemplateKeys.join(',')}`;
            throw new Error(errorMsg);
          }
          const jsconfigTemplate = JSON.stringify(templateToUse);
          if (!jsconfigTemplate || typeof jsconfigTemplate !== 'string') {
            throw new Error(`jsconfigTemplate must be a string but was ${typeof jsconfigTemplate}`);
          }
          const fromPath = path.dirname(jsconfigPath);
          const toPath = this.workspaceRoots[0];
          if (!fromPath || !toPath) {
            throw new Error(`Invalid paths: fromPath=${fromPath}, toPath=${toPath}`);
          }
          const relativeWorkspaceRoot = utils.relativePath(fromPath, toPath) || '.';
          if (typeof relativeWorkspaceRoot !== 'string') {
            throw new Error(
              `relativeWorkspaceRoot must be a string but was ${typeof relativeWorkspaceRoot}: ${relativeWorkspaceRoot}`
            );
          }
          jsconfigContent = processTemplate(jsconfigTemplate, { project_root: relativeWorkspaceRoot });
        }

        updateConfigFile(jsconfigPath, jsconfigContent, this.fileSystemProvider);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        console.error(`writeSfdxJsconfig: Error reading/writing jsconfig: ${errorMessage}`);
        if (errorStack) {
          console.error(`Stack: ${errorStack}`);
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
        const jsconfigTemplate = JSON.stringify(jsconfigCoreTemplate);
        // For core workspaces, the typings are in the core directory, not the project directory
        // Calculate relative path from modules directory to the core directory
        const coreDir = this.type === 'CORE_ALL' ? this.workspaceRoots[0] : path.dirname(this.workspaceRoots[0]);
        const relativeCoreRoot = utils.relativePath(modulesDir, coreDir);
        if (!jsconfigTemplate) {
          throw new Error('Template config not found');
        }
        const jsconfigContent = processTemplate(jsconfigTemplate, { project_root: relativeCoreRoot });
        updateConfigFile(jsconfigPath, jsconfigContent, this.fileSystemProvider);
      } catch (error) {
        console.error('writeCoreJsconfig: Error reading/writing jsconfig:', error);
        throw error;
      }
    }
  }

  private writeTypings(): void {
    let typingsDir: string | undefined;

    switch (this.type) {
      case 'SFDX':
        typingsDir = path.join(this.workspaceRoots[0], '.sfdx', 'typings', 'lwc');
        break;
      case 'CORE_PARTIAL':
        typingsDir = path.join(this.workspaceRoots[0], '..', '.vscode', 'typings', 'lwc');
        break;
      case 'CORE_ALL':
        typingsDir = path.join(this.workspaceRoots[0], '.vscode', 'typings', 'lwc');
        break;
    }

    // TODO should we just be copying every file in this directory rather than hardcoding?
    if (typingsDir) {
      // copy typings to typingsDir
      const resourceTypingsDir = utils.getSfdxResource('typings');
      this.fileSystemProvider.updateDirectoryListing(typingsDir, []);
      try {
        const sourcePath = path.join(resourceTypingsDir, 'lds.d.ts');
        const destPath = path.join(typingsDir, 'lds.d.ts');
        const content = this.fileSystemProvider.getFileContent(sourcePath);
        if (content) {
          this.fileSystemProvider.updateFileContent(destPath, content);
        }
      } catch {
        // ignore
      }
      try {
        const sourcePath = path.join(resourceTypingsDir, 'messageservice.d.ts');
        const destPath = path.join(typingsDir, 'messageservice.d.ts');
        const content = this.fileSystemProvider.getFileContent(sourcePath);
        if (content) {
          this.fileSystemProvider.updateFileContent(destPath, content);
        }
      } catch {
        // ignore
      }
      const dirs = this.fileSystemProvider.getDirectoryListing(path.join(resourceTypingsDir, 'copied'));
      for (const file of dirs) {
        try {
          const sourcePath = path.join(resourceTypingsDir, 'copied', file.name);
          const destPath = path.join(typingsDir, file.name);
          const content = this.fileSystemProvider.getFileContent(sourcePath);
          if (content) {
            this.fileSystemProvider.updateFileContent(destPath, content);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  private getSettings(): Record<string, unknown> {
    const settings: Record<string, unknown> = {};
    this.updateCoreSettings(settings);
    return settings;
  }

  private getCodeWorkspace(): Record<string, unknown> {
    const workspace: { folders: { path: string }[]; settings: Record<string, unknown> } = {
      folders: this.workspaceRoots.map(root => ({ path: root })),
      settings: {}
    };
    this.updateCoreCodeWorkspace(workspace.settings);
    return workspace;
  }

  private updateCoreSettings(settings: Record<string, unknown>): void {
    // Get eslint path once to avoid multiple warnings

    try {
      // Load core settings template
      const coreSettingsTemplate = settingsCoreTemplate;
      // Merge template settings with provided settings
      Object.assign(settings, coreSettingsTemplate);

      // Update eslint settings
      settings['eslint.workingDirectories'] = this.workspaceRoots;
      settings['eslint.validate'] = ['javascript', 'typescript'];
      settings['eslint.options'] = {
        overrideConfigFile: path.join(this.workspaceRoots[0], '.eslintrc.json')
      };

      // Set perforce settings with default values
      settings['perforce.client'] = 'username-localhost-blt';
      settings['perforce.user'] = 'username';
      settings['perforce.port'] = 'ssl:host:port';
    } catch (error) {
      console.error('updateCoreSettings: Error loading core settings template:', error);
      // Fallback to basic settings
      settings['eslint.workingDirectories'] = this.workspaceRoots;
      settings['eslint.validate'] = ['javascript', 'typescript'];
      settings['eslint.options'] = {
        overrideConfigFile: path.join(this.workspaceRoots[0], '.eslintrc.json')
      };
    }
  }

  private updateCoreCodeWorkspace(settings: Record<string, unknown>) {
    settings['eslint.workingDirectories'] = this.workspaceRoots;
    settings['eslint.validate'] = ['javascript', 'typescript'];
    settings['eslint.options'] = {
      overrideConfigFile: path.join(this.workspaceRoots[0], '.eslintrc.json')
    };
  }

  private initSfdxProject(): SfdxProjectConfig {
    return readSfdxProjectConfig(this.workspaceRoots[0], this.fileSystemProvider);
  }
}
