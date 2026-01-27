/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  BaseWorkspaceContext,
  findNamespaceRoots,
  getModulesDirs,
  memoize,
  relativePath,
  updateForceIgnoreFile,
  getExtension,
  toResolvedPath,
  pathStartsWith,
  normalizePath,
  Logger,
  baseTsConfigJson,
  tsConfigTemplateJson
} from '@salesforce/salesforcedx-lightning-lsp-common';
import * as ejs from 'ejs';
import * as path from 'node:path';
import { Connection } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * Holds information and utility methods for a LWC workspace
 */
export class LWCWorkspaceContext extends BaseWorkspaceContext {
  private connection?: Connection;

  /**
   * Set the LSP connection for file operations (works in both Node.js and web)
   */
  public setConnection(connection: Connection): void {
    this.connection = connection;
  }
  /**
   * Clear the memoized namespace cache to force re-detection
   */
  public clearNamespaceCache(): void {
    this.findNamespaceRootsUsingTypeCache = memoize(() => this.findNamespaceRootsUsingType());

    // Immediately call the new memoized function to populate the cache
    void this.findNamespaceRootsUsingTypeCache().then(roots => {
      Logger.info(
        `[clearNamespaceCache] Recalculated namespace roots - lwc: ${JSON.stringify(roots.lwc)}, aura: ${JSON.stringify(roots.aura)}`
      );
    });
  }

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
        Logger.info(
          `[findNamespaceRootsUsingType] Returning roots - lwc: ${JSON.stringify(roots.lwc)}, aura: ${JSON.stringify(roots.aura)}`
        );
        return roots;
      case 'CORE_ALL':
        // optimization: search only inside project/modules/
        const projectDirs = this.fileSystemProvider.getDirectoryListing(normalizePath(this.workspaceRoots[0]));
        for (const entry of projectDirs) {
          const project = entry.name;
          const modulesDir = normalizePath(path.join(this.workspaceRoots[0], project, 'modules'));
          if (this.fileSystemProvider.directoryExists(modulesDir)) {
            const subroots = await findNamespaceRoots(modulesDir, this.fileSystemProvider, 2);
            roots.lwc.push(...subroots.lwc.map(root => normalizePath(root)));
          }
        }
        return roots;
      case 'CORE_PARTIAL':
        // optimization: search only inside modules/
        for (const ws of this.workspaceRoots) {
          const modulesDir = normalizePath(path.join(ws, 'modules'));
          if (this.fileSystemProvider.directoryExists(modulesDir)) {
            const subroots = await findNamespaceRoots(modulesDir, this.fileSystemProvider, 2);
            roots.lwc.push(...subroots.lwc.map(root => normalizePath(root)));
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
        roots.lwc.push(...unknownroots.lwc.map(root => normalizePath(root)));
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
      if (!this.connection) {
        throw new Error('LSP connection not set. Cannot create files.');
      }
      // TODO: This should be moved into configureProject after dev preview
      await this.writeTsconfigJson();
    } catch (error) {
      Logger.error('configureProjectForTs: Error occurred:', error);
      throw error;
    }
  }

  /**
   * Writes TypeScript configuration files for the project
   */
  protected async writeTsconfigJson(): Promise<void> {
    if (this.type !== 'SFDX') {
      return;
    }
    // Write tsconfig.sfdx.json first
    const baseTsConfigPath = path.join(this.workspaceRoots[0], '.sfdx', 'tsconfig.sfdx.json');

    try {
      const baseTsConfig = JSON.stringify(baseTsConfigJson, null, 4);
      this.fileSystemProvider.updateFileStat(baseTsConfigPath, {
        type: 'file',
        exists: true,
        ctime: Date.now(),
        mtime: Date.now(),
        size: baseTsConfig.length
      });
      await this.fileSystemProvider.updateFileContent(baseTsConfigPath, baseTsConfig, this.connection);
    } catch (error) {
      Logger.error('writeTsconfigJson: Error reading/writing base tsconfig:', error);
      throw error;
    }

    // Write to the tsconfig.json in each module subdirectory
    const tsConfigTemplate = JSON.stringify(tsConfigTemplateJson, null, 4);

    const forceignore = path.join(this.workspaceRoots[0], '.forceignore');
    // TODO: We should only be looking through modules that have TS files
    const modulesDirs = getModulesDirs(this.type, this.workspaceRoots, this.fileSystemProvider, () =>
      this.initSfdxProjectConfigCache()
    );

    for (const modulesDir of modulesDirs) {
      const tsConfigPath = path.join(modulesDir, 'tsconfig.json');
      const relativeWorkspaceRoot = relativePath(path.dirname(tsConfigPath), this.workspaceRoots[0]);
      const tsConfigContent = ejs.render(tsConfigTemplate, { project_root: relativeWorkspaceRoot });
      // Update file stat first
      this.fileSystemProvider.updateFileStat(tsConfigPath, {
        type: 'file',
        exists: true,
        ctime: Date.now(),
        mtime: Date.now(),
        size: tsConfigContent.length
      });
      await this.fileSystemProvider.updateFileContent(tsConfigPath, tsConfigContent, this.connection);
      updateForceIgnoreFile(forceignore, true, this.fileSystemProvider);
    }
  }

  public async isLWCTemplate(document: TextDocument): Promise<boolean> {
    const languageIdMatch = document.languageId === 'html';
    const extensionMatch = getExtension(document) === '.html';
    const isInsideModules = await this.isInsideModulesRoots(document);

    return languageIdMatch && extensionMatch && isInsideModules;
  }

  public async isInsideModulesRoots(document: TextDocument): Promise<boolean> {
    // Normalize file path to ensure consistent format (especially Windows drive letter casing and path separators)
    const resolvedPath = toResolvedPath(document.uri);
    const file = normalizePath(resolvedPath);

    for (const ws of this.workspaceRoots) {
      // Normalize workspace root to ensure consistent format
      const normalizedWs = normalizePath(ws);

      // For memfs:// URIs, workspace roots don't have leading slashes, but toResolvedPath returns paths with leading slashes
      // For file:// URIs, both workspace roots and resolved paths have leading slashes
      // So we need to match the file path format to the workspace root format
      let normalizedFile = file;
      if (!normalizedWs.startsWith('/') && file.startsWith('/') && !file.startsWith('//')) {
        // Workspace root doesn't have leading slash (memfs case), but file path does - remove it
        normalizedFile = normalizePath(file.substring(1));
      }

      const startsWith = pathStartsWith(normalizedFile, normalizedWs);

      if (startsWith) {
        // Pass the normalized file path to isFileInsideModulesRoots
        // which expects paths in the same format as namespace roots
        const result = await this.isFileInsideModulesRoots(normalizedFile);
        return result;
      }
    }
    return false;
  }

  public async isLWCJavascript(document: TextDocument): Promise<boolean> {
    return document.languageId === 'javascript' && (await this.isInsideModulesRoots(document));
  }
}
