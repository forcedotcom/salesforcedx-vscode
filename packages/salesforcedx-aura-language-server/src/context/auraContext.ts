/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseWorkspaceContext, Indexer, AURA_EXTENSIONS, findNamespaceRoots } from '@salesforce/salesforcedx-lightning-lsp-common';
import * as path from 'node:path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import URI from 'vscode-uri';

/**
 * Holds information and utility methods for an Aura workspace
 */
export class AuraWorkspaceContext extends BaseWorkspaceContext {
    protected indexers: Map<string, Indexer> = new Map();

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

                    if (await this.pathExists(path.join(forceAppPath, 'lwc'))) {
                        roots.lwc.push(path.join(forceAppPath, 'lwc'));
                    }
                    if (await this.pathExists(path.join(utilsPath, 'lwc'))) {
                        roots.lwc.push(path.join(utilsPath, 'lwc'));
                    }
                    if (await this.pathExists(path.join(registeredEmptyPath, 'lwc'))) {
                        roots.lwc.push(path.join(registeredEmptyPath, 'lwc'));
                    }
                    if (await this.pathExists(path.join(forceAppPath, 'aura'))) {
                        roots.aura.push(path.join(forceAppPath, 'aura'));
                    }
                }
                return roots;
            case 'CORE_ALL':
                // optimization: search only inside project/modules/
                const projects = await this.readDirectory(this.workspaceRoots[0]);
                await Promise.all(
                    projects.map(async (project) => {
                        const modulesDir = path.join(this.workspaceRoots[0], project, 'modules');
                        if (await this.pathExists(modulesDir)) {
                            const subroots = await findNamespaceRoots(modulesDir, 2);
                            roots.lwc.push(...subroots.lwc);
                        }
                        const auraDir = path.join(this.workspaceRoots[0], project, 'components');
                        if (await this.pathExists(auraDir)) {
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
                    if (await this.pathExists(modulesDir)) {
                        const subroots = await findNamespaceRoots(path.join(ws, 'modules'), 2);
                        roots.lwc.push(...subroots.lwc);
                    }
                    const auraDir = path.join(ws, 'components');
                    if (await this.pathExists(auraDir)) {
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
            const markupFiles = await findAuraMarkupIn(namespaceRoot, this);
            files.push(...markupFiles);
        }
        return files;
    }

    public getIndexingProvider(name: string): Indexer | undefined {
        return this.indexers.get(name);
    }

    public addIndexingProvider(provider: { name: string; indexer: Indexer }): void {
        this.indexers.set(provider.name, provider.indexer);
    }

    public async isAuraJavascript(document: TextDocument): Promise<boolean> {
        return document.languageId === 'javascript' && (await this.isInsideAuraRoots(document));
    }

    /** Check if a URI path exists using workspace-compatible methods */
    public async pathExists(filePath: string): Promise<boolean> {
        try {
            // Convert to URI for workspace compatibility
            URI.file(filePath);
            // Use dynamic import to check file existence
            const fs = await import('node:fs');
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /** Read directory contents using workspace-compatible methods */
    public async readDirectory(dirPath: string): Promise<string[]> {
        try {
            // Convert to URI for workspace compatibility
            URI.file(dirPath);
            // Use dynamic import to read directory
            const fs = await import('node:fs');
            const entries = await fs.promises.readdir(dirPath);
            return entries;
        } catch {
            return [];
        }
    }

    /** Check if a path is a directory using workspace-compatible methods */
    public async isDirectory(dirPath: string): Promise<boolean> {
        try {
            // Convert to URI for workspace compatibility
            URI.file(dirPath);
            // Use dynamic import to check if directory
            const fs = await import('node:fs');
            const stat = await fs.promises.stat(dirPath);
            return stat.isDirectory();
        } catch {
            return false;
        }
    }
}

const findAuraMarkupIn = async (namespaceRoot: string, context: AuraWorkspaceContext): Promise<string[]> => {
    const files: string[] = [];
    const dirs = await context.readDirectory(namespaceRoot);
    for (const dir of dirs) {
        const componentDir = path.join(namespaceRoot, dir);
        const isDir = await context.isDirectory(componentDir);
        if (isDir) {
            for (const ext of AURA_EXTENSIONS) {
                const markupFile = path.join(componentDir, dir + ext);
                if (await context.pathExists(markupFile)) {
                    files.push(markupFile);
                }
            }
        }
    }
    return files;
};
