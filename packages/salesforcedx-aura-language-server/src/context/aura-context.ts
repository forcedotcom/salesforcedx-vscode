/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseWorkspaceContext, Indexer, AURA_EXTENSIONS, findNamespaceRoots } from '@salesforce/salesforcedx-lightning-lsp-common';
import { TextDocument } from 'vscode-languageserver';

/**
 * Holds information and utility methods for an Aura workspace
 */
export class AuraWorkspaceContext extends BaseWorkspaceContext {
    protected indexers: Map<string, Indexer> = new Map();

    /**
     * @param workspaceRoots
     * @return AuraWorkspaceContext representing the workspace with workspaceRoots
     */
    public constructor(workspaceRoots: string[] | string) {
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
                const projects = await fs.promises.readdir(this.workspaceRoots[0]);
                await Promise.all(
                    projects.map(async (project) => {
                        const modulesDir = path.join(this.workspaceRoots[0], project, 'modules');
                        if (fs.existsSync(modulesDir)) {
                            const subroots = await findNamespaceRoots(modulesDir, 2);
                            roots.lwc.push(...subroots.lwc);
                        }
                        const auraDir = path.join(this.workspaceRoots[0], project, 'components');
                        if (fs.existsSync(auraDir)) {
                            const subroots = await findNamespaceRoots(auraDir, 2);
                            roots.aura.push(...subroots.lwc);
                        }
                    }),
                );
                return roots;
            case 'CORE_PARTIAL':
                // optimization: search only inside modules/
                for (const ws of this.workspaceRoots) {
                    const modulesDir = path.join(ws, 'modules');
                    if (fs.existsSync(modulesDir)) {
                        const subroots = await findNamespaceRoots(path.join(ws, 'modules'), 2);
                        roots.lwc.push(...subroots.lwc);
                    }
                    const auraDir = path.join(ws, 'components');
                    if (fs.existsSync(auraDir)) {
                        const subroots = await findNamespaceRoots(path.join(ws, 'components'), 2);
                        roots.aura.push(...subroots.lwc);
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

    public async findAllAuraMarkup(): Promise<string[]> {
        const files: string[] = [];
        const namespaceRoots = await this.findNamespaceRootsUsingTypeCache();

        for (const namespaceRoot of namespaceRoots.aura) {
            const markupFiles = await findAuraMarkupIn(namespaceRoot);
            files.push(...markupFiles);
        }
        return files;
    }

    public getIndexingProvider(name: string): Indexer {
        return this.indexers.get(name);
    }

    public addIndexingProvider(provider: { name: string; indexer: Indexer }): void {
        this.indexers.set(provider.name, provider.indexer);
    }

    public async isAuraJavascript(document: TextDocument): Promise<boolean> {
        return document.languageId === 'javascript' && (await this.isInsideAuraRoots(document));
    }
}

const findAuraMarkupIn = async (namespaceRoot: string): Promise<string[]> => {
    const files: string[] = [];
    const dirs = await fs.promises.readdir(namespaceRoot);
    for (const dir of dirs) {
        const componentDir = path.join(namespaceRoot, dir);
        const statResult = await fs.promises.stat(componentDir);
        if (statResult.isDirectory()) {
            for (const ext of AURA_EXTENSIONS) {
                const markupFile = path.join(componentDir, dir + ext);
                if (fs.existsSync(markupFile)) {
                    files.push(markupFile);
                }
            }
        }
    }
    return files;
};
