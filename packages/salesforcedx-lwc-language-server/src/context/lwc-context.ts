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
    getSfdxResource,
    relativePath,
    updateForceIgnoreFile,
} from '@salesforce/salesforcedx-lightning-lsp-common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TextDocument } from 'vscode-languageserver';

const updateConfigFile = (filePath: string, content: string): void => {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content);
};

/**
 * Holds information and utility methods for a LWC workspace
 */
export class LWCWorkspaceContext extends BaseWorkspaceContext {
    /**
     * @param workspaceRoots
     * @return LWCWorkspaceContext representing the workspace with workspaceRoots
     */
    constructor(workspaceRoots: string[] | string) {
        super(workspaceRoots);
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

                    if (fs.existsSync(path.join(forceAppPath, 'lwc'))) {
                        roots.lwc.push(path.join(forceAppPath, 'lwc'));
                    }
                    if (fs.existsSync(path.join(utilsPath, 'lwc'))) {
                        roots.lwc.push(path.join(utilsPath, 'lwc'));
                    }
                    if (fs.existsSync(path.join(registeredEmptyPath, 'lwc'))) {
                        roots.lwc.push(path.join(registeredEmptyPath, 'lwc'));
                    }
                    if (fs.existsSync(path.join(forceAppPath, 'aura'))) {
                        roots.aura.push(path.join(forceAppPath, 'aura'));
                    }
                }
                return roots;
            case 'CORE_ALL':
                // optimization: search only inside project/modules/
                for (const project of await fs.promises.readdir(this.workspaceRoots[0])) {
                    const modulesDir = path.join(this.workspaceRoots[0], project, 'modules');
                    if (fs.existsSync(modulesDir)) {
                        const subroots = await findNamespaceRoots(modulesDir, 2);
                        roots.lwc.push(...subroots.lwc);
                    }
                }
                return roots;
            case 'CORE_PARTIAL':
                // optimization: search only inside modules/
                for (const ws of this.workspaceRoots) {
                    const modulesDir = path.join(ws, 'modules');
                    if (fs.existsSync(modulesDir)) {
                        const subroots = await findNamespaceRoots(path.join(ws, 'modules'), 2);
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
                const unknownroots = await findNamespaceRoots(this.workspaceRoots[0], depth);
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
    public async updateNamespaceRootTypeCache(): Promise<void> {
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
                    const baseTsConfig = await fs.promises.readFile(getSfdxResource('tsconfig-sfdx.base.json'), 'utf8');
                    updateConfigFile(baseTsConfigPath, baseTsConfig);
                } catch (error) {
                    console.error('writeTsconfigJson: Error reading/writing base tsconfig:', error);
                    throw error;
                }

                // Write to the tsconfig.json in each module subdirectory
                let tsConfigTemplate: string;
                try {
                    tsConfigTemplate = await fs.promises.readFile(getSfdxResource('tsconfig-sfdx.json'), 'utf8');
                } catch (error) {
                    console.error('writeTsconfigJson: Error reading tsconfig template:', error);
                    throw error;
                }

                const forceignore = path.join(this.workspaceRoots[0], '.forceignore');
                // TODO: We should only be looking through modules that have TS files
                const modulesDirs = await getModulesDirs(this.type, this.workspaceRoots, this.initSfdxProjectConfigCache.bind(this));

                for (const modulesDir of modulesDirs) {
                    const tsConfigPath = path.join(modulesDir, 'tsconfig.json');
                    const relativeWorkspaceRoot = relativePath(path.dirname(tsConfigPath), this.workspaceRoots[0]);
                    const tsConfigContent = processTemplate(tsConfigTemplate, { project_root: relativeWorkspaceRoot });
                    updateConfigFile(tsConfigPath, tsConfigContent);
                    await updateForceIgnoreFile(forceignore, true);
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
