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
  findLwcNamespaceRoots,
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

          if ((await this.fileSystemAccessor.findFilesWithGlobAsync('**', lwcPath)).length > 0) {
            roots.lwc.push(lwcPath);
          }
          if ((await this.fileSystemAccessor.findFilesWithGlobAsync('**', utilsLwcPath)).length > 0) {
            roots.lwc.push(utilsLwcPath);
          }
          if ((await this.fileSystemAccessor.findFilesWithGlobAsync('**', registeredLwcPath)).length > 0) {
            roots.lwc.push(registeredLwcPath);
          }
          if ((await this.fileSystemAccessor.findFilesWithGlobAsync('**', auraPath)).length > 0) {
            roots.aura.push(auraPath);
          }
        }
        return roots;
      case 'CORE_ALL':
        // optimization: search only inside project/modules/
        const projects = await this.fileSystemAccessor.getDirectoryListing(this.workspaceRoots[0]);
        for (const project of projects) {
          const modulesDir = normalizePath(path.join(this.workspaceRoots[0], project.name, 'modules'));
          if ((await this.fileSystemAccessor.findFilesWithGlobAsync('**', modulesDir)).length > 0) {
            roots.lwc.push(...(await findLwcNamespaceRoots(modulesDir, this.fileSystemAccessor, 2)));
          }
          const auraDir = normalizePath(path.join(this.workspaceRoots[0], project.name, 'components'));
          if ((await this.fileSystemAccessor.findFilesWithGlobAsync('**', auraDir)).length > 0) {
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
          if ((await this.fileSystemAccessor.findFilesWithGlobAsync('**', modulesDir)).length > 0) {
            roots.lwc.push(...(await findLwcNamespaceRoots(modulesDir, this.fileSystemAccessor, 2)));
          }
          const auraDir = normalizePath(path.join(ws, 'components'));
          if ((await this.fileSystemAccessor.findFilesWithGlobAsync('**', auraDir)).length > 0) {
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
        const unknownroots = await findLwcNamespaceRoots(this.workspaceRoots[0], this.fileSystemAccessor, depth);
        roots.lwc.push(...unknownroots);
        return roots;
      }
    }
    return roots;
  }

  public async findAllAuraMarkup(): Promise<NormalizedPath[]> {
    const files: NormalizedPath[] = [];
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

const findAuraMarkupIn = async (namespaceRoot: string, context: AuraWorkspaceContext): Promise<NormalizedPath[]> => {
  const root = normalizePath(namespaceRoot);
  try {
    // One glob per extension: <componentDir>/<name>.<ext>, then filter by Aura convention (file name = parent dir + ext)
    const allFound: NormalizedPath[] = [];
    for (const ext of AURA_EXTENSIONS) {
      const pattern = `*/*${ext}`;
      const found = await context.fileSystemAccessor.findFilesWithGlobAsync(pattern, root);
      if (found.length > 0) allFound.push(...found);
    }
    if (allFound.length === 0) return [];
    return allFound.filter(p => {
      const dirName = path.basename(path.dirname(p));
      const base = path.basename(p);
      const ext = path.extname(p);
      return base === dirName + ext;
    });
  } catch (error) {
    Logger.error(`findAuraMarkupIn: Error accessing ${namespaceRoot}:`, error);
    return [];
  }
};
