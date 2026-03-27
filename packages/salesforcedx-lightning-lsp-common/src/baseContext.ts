/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { Connection } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { nls } from './messages';
import { LspFileSystemAccessor } from './providers/lspFileSystemAccessor';
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

/** Default config when sfdx-project.json is missing or unreadable (e.g. workspace/readFile not yet handled by client). */
const DEFAULT_SFDX_PROJECT_CONFIG: SfdxProjectConfig = {
  packageDirectories: [],
  sfdxPackageDirsPattern: ''
};

const readSfdxProjectConfig = async (
  root: string,
  fileSystemAccessor: LspFileSystemAccessor
): Promise<SfdxProjectConfig> => {
  const configPath = getSfdxProjectFile(root);
  const configText = await fileSystemAccessor.getFileContent(configPath);

  if (!configText) {
    return DEFAULT_SFDX_PROJECT_CONFIG;
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

export const updateForceIgnoreFile = async (
  forceignorePath: string,
  addTsConfig: boolean,
  fileSystemAccessor: LspFileSystemAccessor
): Promise<void> => {
  let forceignoreContent = '';
  try {
    const data = await fileSystemAccessor.getFileContent(forceignorePath);
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
  await fileSystemAccessor.updateFileContent(forceignorePath, forceignoreContent.trim());
};

export const getModulesDirs = async (
  workspaceType: WorkspaceType,
  workspaceRoots: string[],
  fileSystemAccessor: LspFileSystemAccessor,
  getSfdxProjectConfig: () => Promise<SfdxProjectConfig>
): Promise<NormalizedPath[]> => {
  // Normalize workspaceRoots at the start to ensure consistent path format
  // This ensures all path operations use normalized paths
  const normalizedWorkspaceRoots = workspaceRoots.map(root => utils.normalizePath(root));
  switch (workspaceType) {
    case 'SFDX': {
      const config = await getSfdxProjectConfig();
      const { packageDirectories } = config;
      const lwcDirs = new Set<string>();
      for (const pkg of packageDirectories) {
        const pkgRoot = utils.normalizePath(path.join(normalizedWorkspaceRoots[0], pkg.path));

        // Discover lwc directories under the package root dynamically via glob rather than
        // hardcoding a specific layout (e.g. main/default/lwc).
        const found = await fileSystemAccessor.findFilesWithGlobAsync('**/lwc/**', pkgRoot);
        if (found?.length) {
          for (const filePath of found) {
            // NormalizedPath uses forward slashes; extract the deepest .../lwc segment
            const match = filePath.match(/^(.*\/lwc)\//);
            if (match?.[1]) {
              lwcDirs.add(match[1]);
            }
          }
        }
      }
      return Array.from(lwcDirs).map(dir => utils.normalizePath(dir));
    }
    case 'CORE_ALL': {
      // For CORE_ALL, return the modules directories for each project subdirectory
      const projects = await fileSystemAccessor.getDirectoryListing(normalizedWorkspaceRoots[0]);
      const candidates = projects
        .filter(p => p.type === 'directory')
        .map(p => utils.normalizePath(path.join(normalizedWorkspaceRoots[0], p.name, 'modules')));

      const stats = await Promise.all(candidates.map(d => fileSystemAccessor.getFileStat(d)));
      return candidates.filter((_, i) => stats[i]?.type === 'directory');
    }
    case 'CORE_PARTIAL': {
      // For CORE_PARTIAL, return the modules directory for each workspace root
      const candidates = normalizedWorkspaceRoots.map(ws => utils.normalizePath(path.join(ws, 'modules')));
      const stats = await Promise.all(candidates.map(d => fileSystemAccessor.getFileStat(d)));
      return candidates.filter((_, i) => stats[i]?.type === 'directory');
    }
    default:
      return [];
  }
};

export interface BaseWorkspaceContextOptions {
  /**
   * URI of the extension's typings resource directory (e.g.
   * `vscode.Uri.joinPath(context.extensionUri, 'resources', 'sfdx', 'typings').toString()`).
   * When set, writeTypings() reads lds.d.ts and messageservice.d.ts from this URI via LSP
   * and copies them into the workspace's .sfdx/typings/lwc/ directory.
   * Works in both desktop (file://) and web (vscode-extension://) VS Code.
   */
  sfdxTypingsDir?: string;
}

/**
 * Holds information and utility methods for a workspace
 */
export abstract class BaseWorkspaceContext {
  public type!: WorkspaceType;
  public workspaceRoots: NormalizedPath[];

  protected findNamespaceRootsUsingTypeCache: () => Promise<{ lwc: string[]; aura: string[] }>;
  public initSfdxProjectConfigCache: () => Promise<SfdxProjectConfig>;
  public fileSystemAccessor: LspFileSystemAccessor;
  private readonly sfdxTypingsDir?: string;
  private _connection?: Connection;

  /** The LSP connection. Setting this also propagates to the fileSystemAccessor. */
  public get connection(): Connection | undefined {
    return this._connection;
  }
  public set connection(conn: Connection | undefined) {
    this._connection = conn;
    if (conn) {
      this.fileSystemAccessor.setConnection(conn);
    }
  }

  constructor(
    workspaceRoots: NormalizedPath[] | NormalizedPath,
    fileSystemAccessor: LspFileSystemAccessor,
    connection?: Connection,
    options?: BaseWorkspaceContextOptions
  ) {
    // Normalize workspaceRoots to ensure consistent path format (especially Windows drive letter casing)
    this.workspaceRoots = Array.isArray(workspaceRoots) ? workspaceRoots : [workspaceRoots];

    this.findNamespaceRootsUsingTypeCache = utils.memoize(() => this.findNamespaceRootsUsingType());
    this.initSfdxProjectConfigCache = utils.memoize(async () => this.initSfdxProject());
    this.fileSystemAccessor = fileSystemAccessor;
    this.connection = connection;
    this.sfdxTypingsDir = options?.sfdxTypingsDir;
  }

  /**
   * Initialize the workspace context asynchronously
   * If loading SFDX config fails (e.g. client workspace/readFile not yet handled), the error is caught
   * so the server does not crash; callers can retry initSfdxProjectConfigCache() later.
   */
  public initialize(workspaceType: WorkspaceType): void {
    this.type = workspaceType;
    if (this.type === 'SFDX') {
      void this.initSfdxProjectConfigCache().catch(() => {
        // Config load failed (e.g. workspace/readFile unhandled or file missing); continue without config
        console.error('Failed to load SFDX project config, continuing without it');
      });
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
  public async configureProject(): Promise<void> {
    await this.writeSettings();
    await this.writeJsconfigJson();
    await this.writeTypings();
  }

  private async writeSettings(): Promise<void> {
    switch (this.type) {
      case 'CORE_ALL':
        await this.updateCoreCodeWorkspace();
      case 'CORE_PARTIAL':
        // updateCoreSettings is performed by core's setupVSCode
        await this.updateCoreSettings();
        break;
      default:
        break;
    }
  }

  private async updateCoreSettings(): Promise<void> {
    const settingsPath = path.join(this.workspaceRoots[0], '.vscode', 'settings.json');
    const settings = getCoreSettings(this.workspaceRoots);
    await this.fileSystemAccessor.updateFileContent(settingsPath, JSON.stringify(settings, null, 2));
  }

  private async updateCoreCodeWorkspace(): Promise<void> {
    const workspacePath = path.join(this.workspaceRoots[0], 'core.code-workspace');
    const workspace = getCodeWorkspace(this.workspaceRoots);
    await this.fileSystemAccessor.updateFileContent(workspacePath, JSON.stringify(workspace, null, 2));
  }

  private async writeJsconfigJson(): Promise<void> {
    switch (this.type) {
      case 'SFDX':
        await this.writeSfdxJsconfig();
        break;
      case 'CORE_ALL':
      case 'CORE_PARTIAL':
        await this.writeCoreJsconfig();
        break;
      default:
        // No jsconfig needed for other workspace types
        break;
    }
  }

  private async writeSfdxJsconfig(): Promise<void> {
    const modulesDirs = await getModulesDirs(this.type, this.workspaceRoots, this.fileSystemAccessor, () =>
      this.initSfdxProjectConfigCache()
    );

    for (const modulesDir of modulesDirs) {
      const jsconfigPath = path.join(modulesDir, 'jsconfig.json');

      // Skip if tsconfig.json already exists
      const tsconfigPath = path.join(modulesDir, 'tsconfig.json');
      try {
        const fileStat = await this.fileSystemAccessor.getFileStat(tsconfigPath);
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
          const fileStat = await this.fileSystemAccessor.getFileStat(jsconfigPath);
          if (fileStat?.type === 'file' && fileStat?.exists === true) {
            jsconfigExists = true;
          }
        } catch {
          // jsconfig.json doesn't exist
        }

        if (jsconfigExists) {
          const existingConfigContent = await this.fileSystemAccessor.getFileContent(jsconfigPath);
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

        await this.fileSystemAccessor.updateFileContent(jsconfigPath, jsconfigContent);
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
    await updateForceIgnoreFile(forceignorePath, false, this.fileSystemAccessor);
  }

  private async writeCoreJsconfig(): Promise<void> {
    const modulesDirs = await getModulesDirs(this.type, this.workspaceRoots, this.fileSystemAccessor, () =>
      this.initSfdxProjectConfigCache()
    );

    for (const modulesDir of modulesDirs) {
      const jsconfigPath = path.join(modulesDir, 'jsconfig.json');

      // Skip if tsconfig.json already exists
      const tsconfigPath = path.join(modulesDir, 'tsconfig.json');
      const fileStat = await this.fileSystemAccessor.getFileStat(tsconfigPath);
      if (fileStat?.type === 'file' && fileStat?.exists === true) {
        // Skip writing jsconfig when tsconfig.json already exists (as per test expectation)
      } else {
        try {
          const coreDir = this.type === 'CORE_ALL' ? this.workspaceRoots[0] : path.dirname(this.workspaceRoots[0]);
          const relativeCoreRoot = utils.relativePath(modulesDir, coreDir);
          const typingsInclude = `${relativeCoreRoot}/.vscode/typings/lwc/**/*.d.ts`;
          const config = {
            ...jsconfigCore,
            include: [...jsconfigCore.include, typingsInclude]
          };
          const jsconfigContent = JSON.stringify(config, null, 2);
          await this.fileSystemAccessor.updateFileContent(jsconfigPath, jsconfigContent);
        } catch (error) {
          console.error('writeCoreJsconfig: Error reading/writing jsconfig:', error);
          throw error;
        }
      }
    }
  }

  private async writeTypings(): Promise<void> {
    const typingsDir = getTypingsDir(this.type, this.workspaceRoots);
    if (!typingsDir || !this.sfdxTypingsDir) {
      return;
    }
    const base = this.sfdxTypingsDir.replace(/\/$/, '');
    for (const name of ['lds.d.ts', 'messageservice.d.ts', 'apex.d.ts', 'engine.d.ts', 'schema.d.ts']) {
      try {
        const sourceUri = `${base}/${name}`;
        const destPath = path.join(typingsDir, name);
        const content = await this.fileSystemAccessor.getFileContent(sourceUri);
        if (content) {
          await this.fileSystemAccessor.updateFileContent(destPath, content);
        }
      } catch {
        // ignore
      }
    }
  }

  private async initSfdxProject(): Promise<SfdxProjectConfig> {
    return readSfdxProjectConfig(this.workspaceRoots[0], this.fileSystemAccessor);
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
