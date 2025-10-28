/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import ejs from 'ejs';
import * as path from 'node:path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { FileSystemDataProvider, IFileSystemProvider } from './providers/fileSystemDataProvider';
import jsconfigCoreTemplate from './resources/core/jsconfig-core.json';
import settingsCoreTemplate from './resources/core/settings-core.json';
import jsconfigSfdxTemplate from './resources/sfdx/jsconfig-sfdx.json';
import { WorkspaceType, detectWorkspaceType, getSfdxProjectFile } from './shared';
import * as utils from './utils';

export const AURA_EXTENSIONS: string[] = ['.cmp', '.app', '.design', '.evt', '.intf', '.auradoc', '.tokens'];

interface SfdxPackageDirectoryConfig {
    path: string;
}

export interface SfdxProjectConfig {
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
        const packageDirectories = Array.isArray(config.packageDirectories) ? config.packageDirectories.filter(isSfdxPackageDirectoryConfig) : [];
        const sfdxPackageDirsPattern = packageDirectories.map((pkg: SfdxPackageDirectoryConfig) => pkg.path).join(',');
        return {
            ...config,
            packageDirectories,
            sfdxPackageDirsPattern: `{${sfdxPackageDirsPattern}}`,
        };
    } catch (e) {
        throw new Error(`Sfdx project file seems invalid. Unable to parse ${getSfdxProjectFile(root)}. ${e.message}`);
    }
};

const updateConfigFile = (filePath: string, content: string, fileSystemProvider: IFileSystemProvider): void => {
    const dir = path.dirname(filePath);
    fileSystemProvider.updateDirectoryListing(dir, []);
    fileSystemProvider.updateFileContent(filePath, content);
};

export const updateForceIgnoreFile = (forceignorePath: string, addTsConfig: boolean, fileSystemProvider: IFileSystemProvider): void => {
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
    getSfdxProjectConfig: () => SfdxProjectConfig,
): string[] => {
    const modulesDirs: string[] = [];
    switch (workspaceType) {
        case 'SFDX':
            const { packageDirectories } = getSfdxProjectConfig();
            for (const pkg of packageDirectories) {
                // Check both new SFDX structure (main/default) and old structure (meta)
                const newPkgDir = path.join(workspaceRoots[0], pkg.path, 'main', 'default');
                const oldPkgDir = path.join(workspaceRoots[0], pkg.path, 'meta');

                // Check for LWC components in new structure
                const newLwcDir = path.join(newPkgDir, 'lwc');
                const newLwcDirStat = fileSystemProvider.getFileStat(newLwcDir);
                if (newLwcDirStat?.type === 'directory') {
                    // Add the LWC directory itself, not individual components
                    modulesDirs.push(newLwcDir);
                } else {
                    // New structure doesn't exist, check for LWC components in old structure
                    const oldLwcDir = path.join(oldPkgDir, 'lwc');
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
            const projects = fileSystemProvider.getDirectoryListing(workspaceRoots[0]) ?? [];
            for (const project of projects) {
                const modulesDir = path.resolve(workspaceRoots[0], project.name, 'modules');
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
                    modulesDirs.push(modulesDir);
                }
            }
            break;
        case 'CORE_PARTIAL':
            // For CORE_PARTIAL, return the modules directory for each workspace root
            for (const ws of workspaceRoots) {
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
                    modulesDirs.push(modulesDir);
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
    public type: WorkspaceType;
    public workspaceRoots: string[];

    protected findNamespaceRootsUsingTypeCache: () => Promise<{ lwc: string[]; aura: string[] }>;
    public initSfdxProjectConfigCache: () => SfdxProjectConfig;
    public fileSystemProvider: FileSystemDataProvider;
    /**
     * @param workspaceRoots
     * @return BaseWorkspaceContext representing the workspace with workspaceRoots
     */
    constructor(workspaceRoots: string[] | string, fileSystemProvider: FileSystemDataProvider) {
        this.workspaceRoots = typeof workspaceRoots === 'string' ? [path.resolve(workspaceRoots)] : workspaceRoots;

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

    public async isLWCTemplate(document: TextDocument): Promise<boolean> {
        return document.languageId === 'html' && utils.getExtension(document) === '.html' && (await this.isInsideModulesRoots(document));
    }

    public async isInsideAuraRoots(document: TextDocument): Promise<boolean> {
        const file = utils.toResolvedPath(document.uri);
        for (const ws of this.workspaceRoots) {
            if (utils.pathStartsWith(file, ws)) {
                const isInsideAuraRoots = await this.isFileInsideAuraRoots(file);
                return isInsideAuraRoots;
            }
        }
        return false;
    }

    public async isInsideModulesRoots(document: TextDocument): Promise<boolean> {
        const file = utils.toResolvedPath(document.uri);
        for (const ws of this.workspaceRoots) {
            if (utils.pathStartsWith(file, ws)) {
                return this.isFileInsideModulesRoots(file);
            }
        }
        return false;
    }

    public async isFileInsideModulesRoots(file: string): Promise<boolean> {
        const namespaceRoots = await this.findNamespaceRootsUsingTypeCache();
        for (const root of namespaceRoots.lwc) {
            if (utils.pathStartsWith(file, root)) {
                return true;
            }
        }
        return false;
    }

    public async isFileInsideAuraRoots(file: string): Promise<boolean> {
        const namespaceRoots = await this.findNamespaceRootsUsingType();
        for (const root of namespaceRoots.aura) {
            if (utils.pathStartsWith(file, root)) {
                return true;
            }
        }
        return false;
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
        await this.writeSettingsJson();
        await this.writeCodeWorkspace();
    }

    private async writeSettingsJson(): Promise<void> {
        const settingsPath = path.join(this.workspaceRoots[0], '.vscode', 'settings.json');
        const settings = await this.getSettings();
        await updateConfigFile(settingsPath, JSON.stringify(settings, null, 2), this.fileSystemProvider);
    }

    private async writeCodeWorkspace(): Promise<void> {
        const workspacePath = path.join(this.workspaceRoots[0], 'core.code-workspace');
        const workspace = await this.getCodeWorkspace();
        await updateConfigFile(workspacePath, JSON.stringify(workspace, null, 2), this.fileSystemProvider);
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
        const modulesDirs = getModulesDirs(this.type, this.workspaceRoots, this.fileSystemProvider, () => this.initSfdxProjectConfigCache());

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
                        throw new Error('Existing config not found');
                    }
                    const existingConfig: unknown = JSON.parse(existingConfigContent);
                    if (!isRecord(existingConfig)) {
                        throw new Error('Invalid existing config format');
                    }
                    const templateConfig: unknown = jsconfigSfdxTemplate;
                    if (!isRecord(templateConfig)) {
                        throw new Error('Invalid template config format');
                    }

                    // Merge existing config with template config
                    const relativeWorkspaceRoot = utils.relativePath(path.dirname(jsconfigPath), this.workspaceRoots[0]);
                    const templateInclude = templateConfig.include;
                    const processedTemplateInclude = Array.isArray(templateInclude)
                        ? templateInclude.map((include: unknown) =>
                              typeof include === 'string' ? include.replace('<%= project_root %>', relativeWorkspaceRoot) : include,
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
                            ...(isRecord(templateCompilerOptions) ? templateCompilerOptions : {}),
                        },
                        include: [
                            ...(Array.isArray(existingInclude) ? existingInclude.filter((item): item is string => typeof item === 'string') : []),
                            ...processedTemplateInclude,
                        ],
                    };

                    jsconfigContent = JSON.stringify(mergedConfig, null, 4);
                } else {
                    // Create new jsconfig from template
                    const jsconfigTemplate = JSON.stringify(jsconfigSfdxTemplate);
                    const relativeWorkspaceRoot = utils.relativePath(path.dirname(jsconfigPath), this.workspaceRoots[0]);
                    jsconfigContent = processTemplate(jsconfigTemplate, { project_root: relativeWorkspaceRoot });
                }

                await updateConfigFile(jsconfigPath, jsconfigContent, this.fileSystemProvider);
            } catch (error) {
                console.error('writeSfdxJsconfig: Error reading/writing jsconfig:', error);
                throw error;
            }
        }

        // Update forceignore
        const forceignorePath = path.join(this.workspaceRoots[0], '.forceignore');
        await updateForceIgnoreFile(forceignorePath, false, this.fileSystemProvider);
    }

    private async writeCoreJsconfig(): Promise<void> {
        const modulesDirs = getModulesDirs(this.type, this.workspaceRoots, this.fileSystemProvider, () => this.initSfdxProjectConfigCache());

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

    private async writeTypings(): Promise<void> {
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
                await this.fileSystemProvider.updateFileContent(path.join(resourceTypingsDir, 'lds.d.ts'), path.join(typingsDir, 'lds.d.ts'));
            } catch {
                // ignore
            }
            try {
                await this.fileSystemProvider.updateFileContent(
                    path.join(resourceTypingsDir, 'messageservice.d.ts'),
                    path.join(typingsDir, 'messageservice.d.ts'),
                );
            } catch {
                // ignore
            }
            const dirs = await this.fileSystemProvider.getDirectoryListing(path.join(resourceTypingsDir, 'copied'));
            for (const file of dirs ?? []) {
                try {
                    await this.fileSystemProvider.updateFileContent(path.join(resourceTypingsDir, 'copied', file.name), path.join(typingsDir, file.name));
                } catch {
                    // ignore
                }
            }
        }
    }

    private async getSettings(): Promise<Record<string, unknown>> {
        const settings: Record<string, unknown> = {};
        await this.updateCoreSettings(settings);
        return settings;
    }

    private async getCodeWorkspace(): Promise<Record<string, unknown>> {
        const workspace: { folders: { path: string }[]; settings: Record<string, unknown> } = {
            folders: this.workspaceRoots.map((root) => ({ path: root })),
            settings: {},
        };
        await this.updateCoreCodeWorkspace(workspace.settings);
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
                overrideConfigFile: path.join(this.workspaceRoots[0], '.eslintrc.json'),
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
                overrideConfigFile: path.join(this.workspaceRoots[0], '.eslintrc.json'),
            };
        }
    }

    private updateCoreCodeWorkspace(settings: Record<string, unknown>) {
        settings['eslint.workingDirectories'] = this.workspaceRoots;
        settings['eslint.validate'] = ['javascript', 'typescript'];
        settings['eslint.options'] = {
            overrideConfigFile: path.join(this.workspaceRoots[0], '.eslintrc.json'),
        };
    }

    private initSfdxProject(): SfdxProjectConfig {
        return readSfdxProjectConfig(this.workspaceRoots[0], this.fileSystemProvider);
    }
}
