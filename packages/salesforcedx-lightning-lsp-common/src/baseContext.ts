/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import ejs from 'ejs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { TextDocument } from 'vscode-languageserver';
import { WorkspaceType, detectWorkspaceType, getSfdxProjectFile } from './shared';
import * as utils from './utils';

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

const readSfdxProjectConfig = async (root: string): Promise<SfdxProjectConfig> => {
    try {
        const config: unknown = JSON.parse(await vscode.workspace.fs.readFile(vscode.Uri.file(getSfdxProjectFile(root))).then((data) => data.toString()));
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

const updateConfigFile = async (filePath: string, content: string): Promise<void> => {
    const dir = path.dirname(filePath);
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
    await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from(content));
};

export const updateForceIgnoreFile = async (forceignorePath: string, addTsConfig: boolean): Promise<void> => {
    let forceignoreContent = '';
    try {
        const data = await vscode.workspace.fs.readFile(vscode.Uri.file(forceignorePath));
        forceignoreContent = data.toString();
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
    await vscode.workspace.fs.writeFile(vscode.Uri.file(forceignorePath), Buffer.from(forceignoreContent.trim()));
};

// exported for testing
export const processTemplate = (template: string, data: Record<string, unknown>): string => ejs.render(template, data);

export const getModulesDirs = async (
    workspaceType: WorkspaceType,
    workspaceRoots: string[],
    getSfdxProjectConfig: () => Promise<SfdxProjectConfig>,
): Promise<string[]> => {
    const modulesDirs: string[] = [];
    switch (workspaceType) {
        case 'SFDX':
            const { packageDirectories } = await getSfdxProjectConfig();
            for (const pkg of packageDirectories) {
                // Check both new SFDX structure (main/default) and old structure (meta)
                const newPkgDir = path.join(workspaceRoots[0], pkg.path, 'main', 'default');
                const oldPkgDir = path.join(workspaceRoots[0], pkg.path, 'meta');

                // Check for LWC components in new structure
                const newLwcDir = path.join(newPkgDir, 'lwc');
                if ((await vscode.workspace.fs.stat(vscode.Uri.file(newLwcDir))).type === vscode.FileType.Directory) {
                    // Add the LWC directory itself, not individual components
                    modulesDirs.push(newLwcDir);
                } else {
                    // Check for LWC components in old structure
                    const oldLwcDir = path.join(oldPkgDir, 'lwc');
                    if ((await vscode.workspace.fs.stat(vscode.Uri.file(oldLwcDir))).type === vscode.FileType.Directory) {
                        // Add the LWC directory itself, not individual components
                        modulesDirs.push(oldLwcDir);
                    }
                }

                // Note: Aura directories are not included in modulesDirs as they don't typically use TypeScript
                // and this method is primarily used for TypeScript configuration
            }
            break;
        case 'CORE_ALL':
            // For CORE_ALL, return the modules directories for each project
            for (const project of await vscode.workspace.fs
                .readDirectory(vscode.Uri.file(workspaceRoots[0]))
                .then((entries) => entries.map(([name]) => name))) {
                const modulesDir = path.join(workspaceRoots[0], project, 'modules');
                if ((await vscode.workspace.fs.stat(vscode.Uri.file(modulesDir))).type === vscode.FileType.Directory) {
                    modulesDirs.push(modulesDir);
                }
            }
            break;
        case 'CORE_PARTIAL':
            // For CORE_PARTIAL, return the modules directory for each workspace root
            for (const ws of workspaceRoots) {
                const modulesDir = path.join(ws, 'modules');
                if ((await vscode.workspace.fs.stat(vscode.Uri.file(modulesDir))).type === vscode.FileType.Directory) {
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
    public type: WorkspaceType = 'UNKNOWN';
    public workspaceRoots: string[];

    protected findNamespaceRootsUsingTypeCache: () => Promise<{ lwc: string[]; aura: string[] }>;
    public initSfdxProjectConfigCache: () => Promise<SfdxProjectConfig>;

    /**
     * @param workspaceRoots
     * @return BaseWorkspaceContext representing the workspace with workspaceRoots
     */
    constructor(workspaceRoots: string[] | string) {
        this.workspaceRoots = typeof workspaceRoots === 'string' ? [path.resolve(workspaceRoots)] : workspaceRoots;

        this.findNamespaceRootsUsingTypeCache = utils.memoize(this.findNamespaceRootsUsingType.bind(this));
        this.initSfdxProjectConfigCache = utils.memoize(this.initSfdxProject.bind(this));
    }

    /**
     * Initialize the workspace context asynchronously
     */
    public async initialize(): Promise<void> {
        this.type = await detectWorkspaceType(this.workspaceRoots);
        if (this.type === 'SFDX') {
            void this.initSfdxProjectConfigCache();
        }
    }

    public async isAuraMarkup(document: TextDocument): Promise<boolean> {
        return document.languageId === 'html' && AURA_EXTENSIONS.includes(utils.getExtension(document)) && (await this.isInsideAuraRoots(document));
    }

    public async isLWCTemplate(document: TextDocument): Promise<boolean> {
        return document.languageId === 'html' && utils.getExtension(document) === '.html' && (await this.isInsideModulesRoots(document));
    }

    public async isInsideAuraRoots(document: TextDocument): Promise<boolean> {
        const file = utils.toResolvedPath(document.uri);
        for (const ws of this.workspaceRoots) {
            if (utils.pathStartsWith(file, ws)) {
                return this.isFileInsideAuraRoots(file);
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
        const namespaceRoots = await this.findNamespaceRootsUsingTypeCache();
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
        await updateConfigFile(settingsPath, JSON.stringify(settings, null, 2));
    }

    private async writeCodeWorkspace(): Promise<void> {
        const workspacePath = path.join(this.workspaceRoots[0], 'core.code-workspace');
        const workspace = await this.getCodeWorkspace();
        await updateConfigFile(workspacePath, JSON.stringify(workspace, null, 2));
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
        const modulesDirs = await getModulesDirs(this.type, this.workspaceRoots, this.initSfdxProjectConfigCache.bind(this));

        for (const modulesDir of modulesDirs) {
            const jsconfigPath = path.join(modulesDir, 'jsconfig.json');

            // Skip if tsconfig.json already exists
            const tsconfigPath = path.join(modulesDir, 'tsconfig.json');
            if ((await vscode.workspace.fs.stat(vscode.Uri.file(tsconfigPath))).type === vscode.FileType.File) {
                continue;
            }

            try {
                let jsconfigContent: string;

                // If jsconfig already exists, read and update it
                if ((await vscode.workspace.fs.stat(vscode.Uri.file(jsconfigPath))).type === vscode.FileType.File) {
                    const existingConfig: unknown = JSON.parse(
                        await vscode.workspace.fs.readFile(vscode.Uri.file(jsconfigPath)).then((data) => data.toString()),
                    );
                    if (!isRecord(existingConfig)) {
                        throw new Error('Invalid existing config format');
                    }
                    const jsconfigTemplate = await vscode.workspace.fs
                        .readFile(vscode.Uri.file(utils.getSfdxResource('jsconfig-sfdx.json')))
                        .then((data) => data.toString());
                    const templateConfig: unknown = JSON.parse(jsconfigTemplate);
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
                    const jsconfigTemplate = await vscode.workspace.fs
                        .readFile(vscode.Uri.file(utils.getSfdxResource('jsconfig-sfdx.json')))
                        .then((data) => data.toString());
                    const relativeWorkspaceRoot = utils.relativePath(path.dirname(jsconfigPath), this.workspaceRoots[0]);
                    jsconfigContent = processTemplate(jsconfigTemplate, { project_root: relativeWorkspaceRoot });
                }

                await updateConfigFile(jsconfigPath, jsconfigContent);
            } catch (error) {
                console.error('writeSfdxJsconfig: Error reading/writing jsconfig:', error);
                throw error;
            }
        }

        // Update forceignore
        const forceignorePath = path.join(this.workspaceRoots[0], '.forceignore');
        await updateForceIgnoreFile(forceignorePath, false);
    }

    private async writeCoreJsconfig(): Promise<void> {
        const modulesDirs = await getModulesDirs(this.type, this.workspaceRoots, this.initSfdxProjectConfigCache.bind(this));

        for (const modulesDir of modulesDirs) {
            const jsconfigPath = path.join(modulesDir, 'jsconfig.json');

            // Skip if tsconfig.json already exists
            const tsconfigPath = path.join(modulesDir, 'tsconfig.json');
            if ((await vscode.workspace.fs.stat(vscode.Uri.file(tsconfigPath))).type === vscode.FileType.File) {
                // Remove tsconfig.json if it exists (as per test expectation)
                await vscode.workspace.fs.delete(vscode.Uri.file(tsconfigPath));
            }

            try {
                const jsconfigTemplate = await vscode.workspace.fs
                    .readFile(vscode.Uri.file(utils.getCoreResource('jsconfig-core.json')))
                    .then((data) => data.toString());
                // For core workspaces, the typings are in the core directory, not the project directory
                // Calculate relative path from modules directory to the core directory
                const coreDir = this.type === 'CORE_ALL' ? this.workspaceRoots[0] : path.dirname(this.workspaceRoots[0]);
                const relativeCoreRoot = utils.relativePath(modulesDir, coreDir);
                const jsconfigContent = processTemplate(jsconfigTemplate, { project_root: relativeCoreRoot });
                await updateConfigFile(jsconfigPath, jsconfigContent);
            } catch (error) {
                console.error('writeCoreJsconfig: Error reading/writing jsconfig:', error);
                throw error;
            }
        }
    }

    private async writeTypings(): Promise<void> {
        let typingsDir: string;

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
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(typingsDir));
            try {
                await vscode.workspace.fs.copy(vscode.Uri.file(path.join(resourceTypingsDir, 'lds.d.ts')), vscode.Uri.file(path.join(typingsDir, 'lds.d.ts')));
            } catch {
                // ignore
            }
            try {
                await vscode.workspace.fs.copy(
                    vscode.Uri.file(path.join(resourceTypingsDir, 'messageservice.d.ts')),
                    vscode.Uri.file(path.join(typingsDir, 'messageservice.d.ts')),
                );
            } catch {
                // ignore
            }
            const dirs = await vscode.workspace.fs
                .readDirectory(vscode.Uri.file(path.join(resourceTypingsDir, 'copied')))
                .then((entries) => entries.map(([name]) => name));
            for (const file of dirs) {
                try {
                    await vscode.workspace.fs.copy(
                        vscode.Uri.file(path.join(resourceTypingsDir, 'copied', file)),
                        vscode.Uri.file(path.join(typingsDir, file)),
                    );
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

    private async updateCoreSettings(settings: Record<string, unknown>): Promise<void> {
        // Get eslint path once to avoid multiple warnings

        try {
            // Load core settings template
            const coreSettingsTemplate = await vscode.workspace.fs
                .readFile(vscode.Uri.file(utils.getCoreResource('settings-core.json')))
                .then((data) => data.toString());

            // Merge template settings with provided settings
            Object.assign(settings, JSON.parse(coreSettingsTemplate));

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

    private async initSfdxProject(): Promise<SfdxProjectConfig> {
        return readSfdxProjectConfig(this.workspaceRoots[0]);
    }
}
