/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
    BaseWorkspaceContext,
    findNamespaceRoots,
    processTemplate,
    getModulesDirs,
    memoize,
    relativePath,
    updateForceIgnoreFile,
    IFileSystemProvider,
} from '@salesforce/salesforcedx-lightning-lsp-common';
import baseTsConfigJson from '@salesforce/salesforcedx-lightning-lsp-common/src/resources/sfdx/tsconfig-sfdx.base.json';
import tsConfigTemplateJson from '@salesforce/salesforcedx-lightning-lsp-common/src/resources/sfdx/tsconfig-sfdx.json';
import * as path from 'node:path';
import { TextDocument } from 'vscode-languageserver-textdocument';

const updateConfigFile = async (filePath: string, content: string, fileSystemProvider: IFileSystemProvider): Promise<void> => {
    const uri = `${filePath}`;

    // Create the file stat first
    fileSystemProvider.updateFileStat(uri, {
        type: 'file',
        exists: true,
        ctime: Date.now(),
        mtime: Date.now(),
        size: content.length,
    });

    // Store the file content
    fileSystemProvider.updateFileContent(uri, content);
};

const fileExists = async (filePath: string, fileSystemProvider: IFileSystemProvider): Promise<boolean> => {
    const uri = `${filePath}`;
    return fileSystemProvider.fileExists(uri);
};

/**
 * Holds information and utility methods for a LWC workspace
 */
export class LWCWorkspaceContext extends BaseWorkspaceContext {
    public readonly fileSystemProvider: IFileSystemProvider;

    constructor(workspaceRoots: string[], fileSystemProvider: IFileSystemProvider) {
        super(workspaceRoots, fileSystemProvider);
        this.fileSystemProvider = fileSystemProvider;
    }
    /**
     * @returns string list of all lwc and aura namespace roots
     */
    protected async findNamespaceRootsUsingType(): Promise<{ lwc: string[]; aura: string[] }> {
        const roots: { lwc: string[]; aura: string[] } = {
            lwc: [],
            aura: [],
        };
        switch (this.type) {
            case 'SFDX':
                // For SFDX workspaces, check for both lwc and aura directories
                for (const root of this.workspaceRoots) {
                    const forceAppPath = path.join(root, 'force-app', 'main', 'default');
                    const utilsPath = path.join(root, 'utils', 'meta');
                    const registeredEmptyPath = path.join(root, 'registered-empty-folder', 'meta');

                    const lwcPath = path.join(forceAppPath, 'lwc');
                    const auraPath = path.join(forceAppPath, 'aura');
                    const utilsLwcPath = path.join(utilsPath, 'lwc');
                    const registeredLwcPath = path.join(registeredEmptyPath, 'lwc');

                    if (await fileExists(lwcPath, this.fileSystemProvider)) {
                        roots.lwc.push(lwcPath);
                    }
                    if (await fileExists(utilsLwcPath, this.fileSystemProvider)) {
                        roots.lwc.push(utilsLwcPath);
                    }
                    if (await fileExists(registeredLwcPath, this.fileSystemProvider)) {
                        roots.lwc.push(registeredLwcPath);
                    }
                    if (await fileExists(auraPath, this.fileSystemProvider)) {
                        roots.aura.push(auraPath);
                    }
                }
                return roots;
            case 'CORE_ALL':
                // optimization: search only inside project/modules/
                const projectDirs = this.fileSystemProvider.getDirectoryListing(`file://${this.workspaceRoots[0]}`);
                if (projectDirs) {
                    for (const entry of projectDirs) {
                        const project = entry.name;
                        const modulesDir = path.join(this.workspaceRoots[0], project, 'modules');
                        if (await fileExists(modulesDir, this.fileSystemProvider)) {
                            const subroots = await findNamespaceRoots(modulesDir, this.fileSystemProvider, 2);
                            roots.lwc.push(...subroots.lwc);
                            roots.aura.push(...subroots.aura);
                        }
                    }
                }
                return roots;
            case 'CORE_PARTIAL':
                // optimization: search only inside modules/
                for (const ws of this.workspaceRoots) {
                    const modulesDir = path.join(ws, 'modules');
                    if (await fileExists(modulesDir, this.fileSystemProvider)) {
                        const subroots = await findNamespaceRoots(path.join(ws, 'modules'), this.fileSystemProvider, 2);
                        roots.lwc.push(...subroots.lwc);
                    }
                }
                return roots;
            case 'STANDARD':
            case 'STANDARD_LWC':
            case 'MONOREPO':
            case 'UNKNOWN': {
                let depth = 6;
                if (this.type === 'MONOREPO') {
                    depth += 2;
                }
                const unknownroots = await findNamespaceRoots(this.workspaceRoots[0], this.fileSystemProvider, depth);
                roots.lwc.push(...unknownroots.lwc);
                roots.aura.push(...unknownroots.aura);
                return roots;
            }
        }
        return roots;
    }

    /**
     * Updates the namespace root type cache
     */
    public updateNamespaceRootTypeCache() {
        this.findNamespaceRootsUsingTypeCache = memoize(this.findNamespaceRootsUsingType.bind(this));
    }

    /**
     * Configures LWC project to support TypeScript
     */
    public async configureProjectForTs(): Promise<void> {
        try {
            // TODO: This should be moved into configureProject after dev preview
            await this.writeTsconfigJson();
        } catch (error) {
            console.error('configureProjectForTs: Error occurred:', error);
            throw error;
        }
    }

    /**
     * Writes TypeScript configuration files for the project
     */
    protected async writeTsconfigJson(): Promise<void> {
        switch (this.type) {
            case 'SFDX':
                // Write tsconfig.sfdx.json first
                const baseTsConfigPath = path.join(this.workspaceRoots[0], '.sfdx', 'tsconfig.sfdx.json');

                try {
                    const baseTsConfig = JSON.stringify(baseTsConfigJson, null, 4);
                    await updateConfigFile(baseTsConfigPath, baseTsConfig, this.fileSystemProvider);
                } catch (error) {
                    console.error('writeTsconfigJson: Error reading/writing base tsconfig:', error);
                    throw error;
                }

                // Write to the tsconfig.json in each module subdirectory
                const tsConfigTemplate = JSON.stringify(tsConfigTemplateJson, null, 4);

                const forceignore = path.join(this.workspaceRoots[0], '.forceignore');
                // TODO: We should only be looking through modules that have TS files
                const modulesDirs = await getModulesDirs(this.type, this.workspaceRoots, this.fileSystemProvider, this.initSfdxProjectConfigCache.bind(this));

                for (const modulesDir of modulesDirs) {
                    const tsConfigPath = path.join(modulesDir, 'tsconfig.json');
                    const relativeWorkspaceRoot = relativePath(path.dirname(tsConfigPath), this.workspaceRoots[0]);
                    const tsConfigContent = processTemplate(tsConfigTemplate, { project_root: relativeWorkspaceRoot });
                    await updateConfigFile(tsConfigPath, tsConfigContent, this.fileSystemProvider);
                    await updateForceIgnoreFile(forceignore, true, this.fileSystemProvider);
                }
                break;
            default:
                break;
        }
    }

    public async isLWCJavascript(document: TextDocument): Promise<boolean> {
        return document.languageId === 'javascript' && (await this.isInsideModulesRoots(document));
    }
}
