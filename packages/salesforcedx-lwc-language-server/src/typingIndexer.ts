/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  detectWorkspaceHelper,
  WorkspaceType,
  LspFileSystemAccessor,
  normalizePath,
  NormalizedPath
} from '@salesforce/salesforcedx-lightning-lsp-common';
import * as path from 'node:path';
import { Connection } from 'vscode-languageserver';
import { getWorkspaceRoot, getSfdxPackageDirsPattern } from './baseIndexer';
import { fromMeta, declarationsFromCustomLabels, getDeclaration } from './typing';

const basenameRegex = new RegExp(/(?<name>[\w-_]+)\.[^/]+$/);

type BaseIndexerAttributes = {
  workspaceRoot: NormalizedPath;
};

// visible for testing
export const pathBasename = (filename: string): string => {
  const parsedPath = path.parse(filename).base;
  const match = basenameRegex.exec(parsedPath);
  return match?.groups?.name ?? '';
};

// Type definition for TypingIndexer data structure
type TypingIndexerData = {
  workspaceRoot: NormalizedPath;
  typingsBaseDir: NormalizedPath;
  projectType: WorkspaceType;
  fileSystemAccessor: LspFileSystemAccessor;
  connection?: Connection;
};

// Utility function to diff items
const diffItems = (items: string[], compareItems: string[]): string[] => {
  const compareBasenames = new Set(compareItems.map(pathBasename));
  return items.filter(item => {
    const filename = pathBasename(item);
    return !compareBasenames.has(filename);
  });
};

// Utility function to create new meta typings
const createNewMetaTypings = async (indexer: TypingIndexerData): Promise<void> => {
  const newFiles = diffItems(await getMetaFiles(indexer), await getMetaTypings(indexer));

  // Process and write each typing file immediately
  for (const filename of newFiles) {
    const typing = fromMeta(filename);
    const uri = path.join(indexer.typingsBaseDir, typing.fileName);
    const content = getDeclaration(typing);

    // Use updateFileContent with connection to create file via LSP
    await indexer.fileSystemAccessor.updateFileContent(uri, content);
  }
};

// Utility function to delete stale meta typings
const deleteStaleMetaTypings = async (indexer: TypingIndexerData): Promise<void> => {
  const staleTypings = diffItems(await getMetaTypings(indexer), await getMetaFiles(indexer));
  const filesToDelete: string[] = [];

  for (const filename of staleTypings) {
    const uri = normalizePath(filename);
    if (await indexer.fileSystemAccessor.fileExists(uri)) {
      filesToDelete.push(uri);
    }
  }

  for (const pathToDelete of filesToDelete) {
    await indexer.fileSystemAccessor.deleteFile(pathToDelete);
  }
};

// Utility function to save custom label typings
const saveCustomLabelTypings = async (indexer: TypingIndexerData): Promise<void> => {
  const customLabelFiles = await getCustomLabelFiles(indexer);
  const typings: string[] = [];

  for (const filename of customLabelFiles) {
    const uri = normalizePath(filename);
    if (await indexer.fileSystemAccessor.fileExists(uri)) {
      const content = await indexer.fileSystemAccessor.getFileContent(uri);
      if (content) {
        const data = Buffer.from(content, 'utf8');
        const typing = await declarationsFromCustomLabels(data);
        typings.push(typing);
      }
    }
  }

  const fileContent = typings.join('\n');
  if (fileContent.length > 0) {
    const customLabelTypingsPath = normalizePath(
      path.join(indexer.workspaceRoot, '.sfdx', 'typings', 'lwc', 'customlabels.d.ts')
    );
    await indexer.fileSystemAccessor.updateFileContent(customLabelTypingsPath, fileContent);
  }
};

// Utility function to get meta files
const getMetaFiles = async (indexer: TypingIndexerData): Promise<string[]> => {
  const packageDirsPattern = await getSfdxPackageDirsPattern(indexer.workspaceRoot, indexer.fileSystemAccessor);
  return await indexer.fileSystemAccessor.findFilesWithGlobAsync(
    `${packageDirsPattern}/**/{staticresources,contentassets,messageChannels}/*.{resource,asset,messageChannel}-meta.xml`,
    indexer.workspaceRoot
  );
};

// Utility function to get meta typings
// visible for testing
export const getMetaTypings = async (indexer: TypingIndexerData): Promise<string[]> =>
  await indexer.fileSystemAccessor
    .findFilesWithGlobAsync('*.{messageChannel,resource,asset}.d.ts', indexer.typingsBaseDir)
    .then(paths => paths.map(p => path.resolve(p)));

// Utility function to get custom label files
const getCustomLabelFiles = async (indexer: TypingIndexerData): Promise<string[]> => {
  const packageDirsPattern = await getSfdxPackageDirsPattern(indexer.workspaceRoot, indexer.fileSystemAccessor);
  return await indexer.fileSystemAccessor.findFilesWithGlobAsync(
    `${packageDirsPattern}/**/labels/CustomLabels.labels-meta.xml`,
    indexer.workspaceRoot
  );
};

// Legacy class for backward compatibility (deprecated)
export default class TypingIndexer {
  public readonly workspaceRoot: NormalizedPath;
  public typingsBaseDir!: NormalizedPath;
  public projectType!: WorkspaceType;
  public metaFiles: string[] = [];
  public fileSystemAccessor: LspFileSystemAccessor;
  public connection?: Connection;

  // visible for testing
  public static diff(items: string[], compareItems: string[]): string[] {
    return diffItems(items, compareItems);
  }

  constructor(attributes: BaseIndexerAttributes, fileSystemAccessor: LspFileSystemAccessor) {
    this.workspaceRoot = getWorkspaceRoot(attributes.workspaceRoot);
    this.fileSystemAccessor = fileSystemAccessor;
    // projectType and typingsBaseDir will be set by the async initialization
  }

  /**
   * Set the LSP connection for file operations (works in both Node.js and web)
   */
  public setConnection(connection?: Connection): void {
    if (connection) {
      this.connection = connection;
    }
  }

  /**
   * Creates and initializes a TypingIndexer instance
   */
  public static async create(
    attributes: BaseIndexerAttributes,
    fileSystemAccessor: LspFileSystemAccessor,
    connection?: Connection
  ): Promise<TypingIndexer> {
    const indexer = new TypingIndexer(attributes, fileSystemAccessor);
    indexer.setConnection(connection);
    await indexer.initialize();
    return indexer;
  }

  /**
   * Initializes the TypingIndexer with workspace type detection and sets up typings
   */
  private async initialize(): Promise<void> {
    this.projectType = await detectWorkspaceHelper(this.workspaceRoot, this.fileSystemAccessor);

    switch (this.projectType) {
      case 'SFDX':
        this.typingsBaseDir = normalizePath(path.join(this.workspaceRoot, '.sfdx', 'typings', 'lwc'));
        break;
      case 'CORE_PARTIAL':
        this.typingsBaseDir = normalizePath(path.join(this.workspaceRoot, '..', '.vscode', 'typings', 'lwc'));
        break;
      case 'CORE_ALL':
        this.typingsBaseDir = normalizePath(path.join(this.workspaceRoot, '.vscode', 'typings', 'lwc'));
        break;
    }

    // Initialize typings for SFDX workspaces
    if (this.projectType === 'SFDX') {
      this.metaFiles = await getMetaFiles(this);
      await this.createNewMetaTypings();
      await this.deleteStaleMetaTypings();
      await this.saveCustomLabelTypings();
    }
  }

  // visible for testing
  public async createNewMetaTypings(): Promise<void> {
    return createNewMetaTypings(this);
  }

  // visible for testing
  public async deleteStaleMetaTypings(): Promise<void> {
    return deleteStaleMetaTypings(this);
  }

  // visible for testing
  public async saveCustomLabelTypings(): Promise<void> {
    return saveCustomLabelTypings(this);
  }
}
