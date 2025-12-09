/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  BaseWorkspaceContext,
  Indexer,
  AURA_EXTENSIONS,
  findNamespaceRoots
} from '@salesforce/salesforcedx-lightning-lsp-common';
import * as path from 'node:path';
import { TextDocument } from 'vscode-languageserver-textdocument';

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
      aura: []
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
          const lwcPathExists = this.fileSystemProvider.fileExists(lwcPath);
          const utilsLwcPathExists = this.fileSystemProvider.fileExists(utilsLwcPath);
          const registeredLwcPathExists = this.fileSystemProvider.fileExists(registeredLwcPath);
          const auraPathExists = this.fileSystemProvider.fileExists(auraPath);

          if (lwcPathExists) {
            roots.lwc.push(lwcPath);
          }
          if (utilsLwcPathExists) {
            roots.lwc.push(path.join(utilsPath, 'lwc'));
          }
          if (registeredLwcPathExists) {
            roots.lwc.push(path.join(registeredEmptyPath, 'lwc'));
          }
          if (auraPathExists) {
            roots.aura.push(auraPath);
          }
        }
        return roots;
      case 'CORE_ALL':
        // optimization: search only inside project/modules/
        const projects = this.fileSystemProvider.getDirectoryListing(this.workspaceRoots[0]);
        for (const project of projects) {
          const modulesDir = path.join(this.workspaceRoots[0], project.name, 'modules');
          if (this.fileSystemProvider.fileExists(modulesDir)) {
            const subroots = await findNamespaceRoots(modulesDir, this.fileSystemProvider, 2);
            roots.lwc.push(...subroots.lwc);
          }
          const auraDir = path.join(this.workspaceRoots[0], project.name, 'components');
          if (this.fileSystemProvider.fileExists(auraDir)) {
            const subroots = await findNamespaceRoots(auraDir, this.fileSystemProvider, 2);
            roots.aura.push(...subroots.lwc);
          }
        }
        return roots;
      case 'CORE_PARTIAL':
        // optimization: search only inside modules/
        for (const ws of this.workspaceRoots) {
          const modulesDir = path.join(ws, 'modules');
          if (this.fileSystemProvider.fileExists(modulesDir)) {
            const subroots = await findNamespaceRoots(path.join(ws, 'modules'), this.fileSystemProvider, 2);
            roots.lwc.push(...subroots.lwc);
          }
          const auraDir = path.join(ws, 'components');
          if (this.fileSystemProvider.fileExists(auraDir)) {
            const subroots = await findNamespaceRoots(path.join(ws, 'components'), this.fileSystemProvider, 2);
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
        const unknownroots = await findNamespaceRoots(this.workspaceRoots[0], this.fileSystemProvider, depth);
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
}

const findAuraMarkupIn = async (namespaceRoot: string, context: AuraWorkspaceContext): Promise<string[]> => {
  const files: string[] = [];

  try {
    const dirs = context.fileSystemProvider.getDirectoryListing(namespaceRoot);

    for (const dir of dirs) {
      const componentDir = path.join(namespaceRoot, dir.name);
      const isDir = context.fileSystemProvider.directoryExists(componentDir);

      if (isDir) {
        for (const ext of AURA_EXTENSIONS) {
          const markupFile = path.join(componentDir, dir.name + ext);
          const exists = context.fileSystemProvider.fileExists(markupFile);
          if (exists) {
            files.push(markupFile);
          }
        }
      }
    }
  } catch (error) {
    console.error(`findAuraMarkupIn: Error accessing ${namespaceRoot}:`, error);
  }

  return files;
};
