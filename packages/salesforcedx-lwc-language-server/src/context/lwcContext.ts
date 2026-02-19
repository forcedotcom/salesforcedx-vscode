/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  BaseWorkspaceContext,
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
  tsConfigTemplateJson,
  type NormalizedPath
} from '@salesforce/salesforcedx-lightning-lsp-common';
import * as ejs from 'ejs';
import * as path from 'node:path';
import { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * Holds information and utility methods for a LWC workspace
 */
export class LWCWorkspaceContext extends BaseWorkspaceContext {
  /**
   * Clear the memoized namespace cache to force re-detection
   */
  public clearNamespaceCache(): void {
    this.findNamespaceRootsUsingTypeCache = memoize(() => this.findNamespaceRootsUsingType());

    // Immediately call the new memoized function to populate the cache
    void this.findNamespaceRootsUsingTypeCache();
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
      case 'SFDX': {
        // For SFDX workspaces, discover lwc and aura roots via findFilesWithGlobAsync.
        // Call via provider so 'this' is bound when findFilesWithGlobAsync runs.
        const provider = this.fileSystemProvider;
        for (const root of this.workspaceRoots) {
          const normalizedRoot = normalizePath(root);
          const forceAppPath = normalizePath(path.join(root, 'force-app', 'main', 'default'));
          const lwcPath = normalizePath(path.join(forceAppPath, 'lwc'));
          const auraPath = normalizePath(path.join(forceAppPath, 'aura'));
          const utilsLwcPath = normalizePath(path.join(root, 'utils', 'meta', 'lwc'));
          const registeredLwcPath = normalizePath(path.join(root, 'registered-empty-folder', 'meta', 'lwc'));

          if ((await provider.findFilesWithGlobAsync?.('force-app/main/default/lwc/**', normalizedRoot))?.length) {
            roots.lwc.push(lwcPath);
          }
          if ((await provider.findFilesWithGlobAsync?.('utils/meta/lwc/**', normalizedRoot))?.length) {
            roots.lwc.push(utilsLwcPath);
          }
          if ((await provider.findFilesWithGlobAsync?.('registered-empty-folder/meta/lwc/**', normalizedRoot))?.length) {
            roots.lwc.push(registeredLwcPath);
          }
          if ((await provider.findFilesWithGlobAsync?.('force-app/main/default/aura/**', normalizedRoot))?.length) {
            roots.aura.push(auraPath);
          }
        }
        return roots;
      }
      case 'CORE_ALL': {
        // optimization: discover LWC roots under project/modules/ via findFilesWithGlobAsync
        const workspaceRoot = normalizePath(this.workspaceRoots[0]);
        const pathsUnderLwc =
          (await this.fileSystemProvider.findFilesWithGlobAsync('*/modules/**/lwc/**', workspaceRoot)) ?? [];
        const lwcRootDirs = [
          ...new Set(
            pathsUnderLwc
              .map(p => {
                const segments = p.split(path.sep);
                const i = segments.lastIndexOf('lwc');
                return i === -1 ? null : normalizePath(segments.slice(0, i + 1).join(path.sep));
              })
              .filter((root): root is NormalizedPath => root != null)
          )
        ];
        roots.lwc.push(...lwcRootDirs);
        return roots;
      }
      case 'CORE_PARTIAL': {
        // optimization: discover LWC roots under modules/ via findFilesWithGlobAsync
        const pathsUnderModulesLwc =
          (await Promise.all(
            this.workspaceRoots.map(ws =>
              this.fileSystemProvider.findFilesWithGlobAsync('modules/**/lwc/**', normalizePath(ws))
            )
          )) ?? [];
        const lwcRootDirs = [
          ...new Set(
            pathsUnderModulesLwc
              .flatMap(paths => paths ?? [])
              .map(p => {
                const segments = p.split(path.sep);
                const i = segments.lastIndexOf('lwc');
                return i === -1 ? null : normalizePath(segments.slice(0, i + 1).join(path.sep));
              })
              .filter((r): r is NormalizedPath => r != null)
          )
        ];
        roots.lwc.push(...lwcRootDirs);
        return roots;
      }
      case 'STANDARD':
      case 'STANDARD_LWC':
      case 'MONOREPO':
      case 'UNKNOWN': {
        // discover all LWC roots via findFilesWithGlobAsync (same dirs findNamespaceRoots would find)
        const workspaceRoot = normalizePath(this.workspaceRoots[0]);
        const pathsUnderLwc = (await this.fileSystemProvider.findFilesWithGlobAsync('**/lwc/**', workspaceRoot)) ?? [];
        const IGNORED_DIRS = new Set(['node_modules', 'bin', 'target', 'jest-modules', 'repository', 'git']);
        const lwcRootDirs = [
          ...new Set(
            pathsUnderLwc
              .map(p => {
                const segments = p.split(path.sep);
                const i = segments.lastIndexOf('lwc');
                if (i === -1) return null;
                const rootPath = normalizePath(segments.slice(0, i + 1).join(path.sep));
                const hasIgnored = segments.slice(0, i + 1).some(seg => IGNORED_DIRS.has(seg));
                return hasIgnored ? null : rootPath;
              })
              .filter((root): root is NormalizedPath => root != null)
          )
        ];
        roots.lwc.push(...lwcRootDirs);
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
    const modulesDirs = await getModulesDirs(this.type, this.workspaceRoots, this.fileSystemProvider, () =>
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
      await updateForceIgnoreFile(forceignore, true, this.fileSystemProvider);
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
