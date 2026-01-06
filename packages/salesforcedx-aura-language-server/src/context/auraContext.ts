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
  findNamespaceRoots,
  Logger,
  normalizePath,
  NormalizedPath
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
          const forceAppPath = normalizePath(path.join(root, 'force-app', 'main', 'default'));
          const utilsPath = normalizePath(path.join(root, 'utils', 'meta'));
          const registeredEmptyPath = normalizePath(path.join(root, 'registered-empty-folder', 'meta'));

          const lwcPath = normalizePath(path.join(forceAppPath, 'lwc'));
          const auraPath = normalizePath(path.join(forceAppPath, 'aura'));

          const utilsLwcPath = normalizePath(path.join(utilsPath, 'lwc'));
          const registeredLwcPath = normalizePath(path.join(registeredEmptyPath, 'lwc'));

          if (this.fileSystemProvider.directoryExists(lwcPath)) {
            roots.lwc.push(lwcPath);
          }
          if (this.fileSystemProvider.directoryExists(utilsLwcPath)) {
            roots.lwc.push(utilsLwcPath);
          }
          if (this.fileSystemProvider.directoryExists(registeredLwcPath)) {
            roots.lwc.push(registeredLwcPath);
          }
          if (this.fileSystemProvider.directoryExists(auraPath)) {
            roots.aura.push(auraPath);
          }
        }
        return roots;
      case 'CORE_ALL':
        // optimization: search only inside project/modules/
        const projects = this.fileSystemProvider.getDirectoryListing(this.workspaceRoots[0]);
        for (const project of projects) {
          const modulesDir = normalizePath(path.join(this.workspaceRoots[0], project.name, 'modules'));
          if (this.fileSystemProvider.directoryExists(modulesDir)) {
            const subroots = await findNamespaceRoots(modulesDir, this.fileSystemProvider, 2);
            roots.lwc.push(...subroots.lwc);
          }
          const auraDir = normalizePath(path.join(this.workspaceRoots[0], project.name, 'components'));
          if (this.fileSystemProvider.directoryExists(auraDir)) {
            // The components directory itself is the Aura namespace root
            // (findNamespaceRoots only detects LWC, not Aura)
            roots.aura.push(auraDir);
          }
        }
        return roots;
      case 'CORE_PARTIAL':
        // optimization: search only inside modules/
        for (const ws of this.workspaceRoots) {
          const modulesDir = normalizePath(path.join(ws, 'modules'));
          if (this.fileSystemProvider.directoryExists(modulesDir)) {
            const subroots = await findNamespaceRoots(modulesDir, this.fileSystemProvider, 2);
            roots.lwc.push(...subroots.lwc);
          }
          const auraDir = normalizePath(path.join(ws, 'components'));
          if (this.fileSystemProvider.directoryExists(auraDir)) {
            // The components directory itself is the Aura namespace root
            // (findNamespaceRoots only detects LWC, not Aura)
            roots.aura.push(auraDir);
          }
        }
        return roots;
      case 'STANDARD':
      case 'STANDARD_LWC':
      case 'MONOREPO':
      case 'UNKNOWN': {
        const depth = this.type === 'MONOREPO' ? 8 : 6;
        const unknownroots = await findNamespaceRoots(this.workspaceRoots[0], this.fileSystemProvider, depth);
        roots.lwc.push(...unknownroots.lwc);
        return roots;
      }
    }
    return roots;
  }

  public async findAllAuraMarkup(): Promise<NormalizedPath[]> {
    const files: NormalizedPath[] = [];
    const namespaceRoots = await this.findNamespaceRootsUsingTypeCache();

    for (const namespaceRoot of namespaceRoots.aura) {
      const markupFiles = findAuraMarkupIn(namespaceRoot, this);
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

const findAuraMarkupIn = (namespaceRoot: string, context: AuraWorkspaceContext): NormalizedPath[] => {
  const files: NormalizedPath[] = [];

  try {
    const dirs = context.fileSystemProvider.getDirectoryListing(normalizePath(namespaceRoot));

    for (const dir of dirs) {
      const componentDir = normalizePath(path.join(namespaceRoot, dir.name));
      const isDir = context.fileSystemProvider.directoryExists(componentDir);

      if (isDir) {
        for (const ext of AURA_EXTENSIONS) {
          // Construct path using namespaceRoot and dir.name to preserve original casing
          const markupFile = normalizePath(path.join(namespaceRoot, dir.name, dir.name + ext));
          if (context.fileSystemProvider.fileExists(markupFile)) {
            files.push(markupFile);
          }
        }
      }
    }
  } catch (error) {
    Logger.error(`findAuraMarkupIn: Error accessing ${namespaceRoot}:`, error);
  }

  return files;
};
