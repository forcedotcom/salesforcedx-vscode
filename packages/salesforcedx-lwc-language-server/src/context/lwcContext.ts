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
import * as path from 'node:path';
import * as vscode from 'vscode';
import { TextDocument } from 'vscode-languageserver';

const updateConfigFile = async (filePath: string, content: string): Promise<void> => {
    const dir = path.dirname(filePath);
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
    await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from(content, 'utf8'));
};

const fileExists = async (filePath: string): Promise<boolean> => {
    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
        return true;
    } catch {
        return false;
    }
};

/**
 * Holds information and utility methods for a LWC workspace
 */
export class LWCWorkspaceContext extends BaseWorkspaceContext {
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

                    if (await fileExists(path.join(forceAppPath, 'lwc'))) {
                        roots.lwc.push(path.join(forceAppPath, 'lwc'));
                    }
                    if (await fileExists(path.join(utilsPath, 'lwc'))) {
                        roots.lwc.push(path.join(utilsPath, 'lwc'));
                    }
                    if (await fileExists(path.join(registeredEmptyPath, 'lwc'))) {
                        roots.lwc.push(path.join(registeredEmptyPath, 'lwc'));
                    }
                    if (await fileExists(path.join(forceAppPath, 'aura'))) {
                        roots.aura.push(path.join(forceAppPath, 'aura'));
                    }
                }
                return roots;
            case 'CORE_ALL':
                // optimization: search only inside project/modules/
                const projectDirs = await vscode.workspace.fs.readDirectory(vscode.Uri.file(this.workspaceRoots[0]));
                for (const [project] of projectDirs) {
                    const modulesDir = path.join(this.workspaceRoots[0], project, 'modules');
                    if (await fileExists(modulesDir)) {
                        const subroots = await findNamespaceRoots(modulesDir, 2);
                        roots.lwc.push(...subroots.lwc);
                    }
                }
                return roots;
            case 'CORE_PARTIAL':
                // optimization: search only inside modules/
                for (const ws of this.workspaceRoots) {
                    const modulesDir = path.join(ws, 'modules');
                    if (await fileExists(modulesDir)) {
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
                    const baseTsConfigBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(getSfdxResource('tsconfig-sfdx.base.json')));
                    const baseTsConfig = Buffer.from(baseTsConfigBuffer).toString('utf8');
                    await updateConfigFile(baseTsConfigPath, baseTsConfig);
                } catch (error) {
                    console.error('writeTsconfigJson: Error reading/writing base tsconfig:', error);
                    throw error;
                }

                // Write to the tsconfig.json in each module subdirectory
                let tsConfigTemplate: string;
                try {
                    const tsConfigTemplateBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(getSfdxResource('tsconfig-sfdx.json')));
                    tsConfigTemplate = Buffer.from(tsConfigTemplateBuffer).toString('utf8');
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
                    await updateConfigFile(tsConfigPath, tsConfigContent);
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
