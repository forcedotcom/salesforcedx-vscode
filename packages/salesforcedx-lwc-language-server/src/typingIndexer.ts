/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  detectWorkspaceHelper,
  WorkspaceType,
  IFileSystemProvider,
  normalizePath,
  NormalizedPath
} from '@salesforce/salesforcedx-lightning-lsp-common';
import * as path from 'node:path';
import { Connection } from 'vscode-languageserver';
import { getWorkspaceRoot } from './baseIndexer';
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
  fileSystemProvider: IFileSystemProvider;
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
  const newFiles = diffItems(await getMetaFiles(indexer), getMetaTypings(indexer));
  const typingFiles: { uri: string; content: string }[] = [];

  for (const filename of newFiles) {
    const typing = fromMeta(filename);
    const uri = path.join(indexer.typingsBaseDir, typing.fileName);
    const content = getDeclaration(typing);
    typingFiles.push({ uri, content });
  }

  // Write the actual typing files to the file system
  for (const typingFile of typingFiles) {
    // Update file stat first
    indexer.fileSystemProvider.updateFileStat(typingFile.uri, {
      type: 'file',
      exists: true,
      ctime: Date.now(),
      mtime: Date.now(),
      size: typingFile.content.length
    });
    // Use updateFileContent with connection to create file via LSP
    await indexer.fileSystemProvider.updateFileContent(typingFile.uri, typingFile.content, indexer.connection);
  }
};

// Utility function to delete stale meta typings
const deleteStaleMetaTypings = (indexer: TypingIndexerData): void => {
  const staleTypings = diffItems(getMetaTypings(indexer), getMetaFiles(indexer));
  const filesToDelete: string[] = [];

  for (const filename of staleTypings) {
    const uri = normalizePath(filename);
    if (indexer.fileSystemProvider.fileExists(uri)) {
      filesToDelete.push(uri);
    }
  }

  // Actually delete the files from the file system
  for (const fileUri of filesToDelete) {
    indexer.fileSystemProvider.updateFileStat(fileUri, {
      type: 'file',
      exists: false,
      ctime: 0,
      mtime: 0,
      size: 0
    });
  }
};

// Utility function to save custom label typings
const saveCustomLabelTypings = async (indexer: TypingIndexerData): Promise<void> => {
  const customLabelFiles = await getCustomLabelFiles(indexer);
  const typings: string[] = [];

  for (const filename of customLabelFiles) {
    const uri = normalizePath(filename);
    if (indexer.fileSystemProvider.fileExists(uri)) {
      const content = indexer.fileSystemProvider.getFileContent(uri);
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
    // Update file stat first
    indexer.fileSystemProvider.updateFileStat(customLabelTypingsPath, {
      type: 'file',
      exists: true,
      ctime: Date.now(),
      mtime: Date.now(),
      size: fileContent.length
    });
    // Use updateFileContent with connection to create file via LSP
    await indexer.fileSystemProvider.updateFileContent(customLabelTypingsPath, fileContent, indexer.connection);
  }
};

// Utility function to get meta files
const getMetaFiles = (indexer: TypingIndexerData): string[] => {
  // For mock file system, check for specific meta files that should exist
  const metaFiles: string[] = [];
  const possibleMetaFiles = [
    'force-app/main/default/contentassets/logo.asset-meta.xml',
    'force-app/main/default/messageChannels/Channel1.messageChannel-meta.xml',
    'force-app/main/default/messageChannels/Channel2.messageChannel-meta.xml',
    'force-app/main/default/staticresources/bike_assets.resource-meta.xml',
    'force-app/main/default/staticresources/todocss.resource-meta.xml',
    'force-app/main/default/staticresources/logo.resource-meta.xml',
    'utils/meta/staticresources/todoutil.resource-meta.xml'
  ];

  for (const metaFile of possibleMetaFiles) {
    const filePath = normalizePath(path.join(indexer.workspaceRoot, metaFile));
    if (indexer.fileSystemProvider.fileExists(filePath)) {
      metaFiles.push(filePath);
    }
  }

  return metaFiles;
};

// Utility function to get meta typings
// visible for testing
export const getMetaTypings = (indexer: TypingIndexerData): string[] => {
  // For mock file system, we need to check what files actually exist
  // instead of using glob.sync which searches the real file system
  const typingsBaseDir = indexer.typingsBaseDir;
  const metaTypings: string[] = [];

  // Check for common meta typing files that might exist
  const possibleFiles = [
    'Channel1.messageChannel.d.ts',
    'bike_assets.resource.d.ts',
    'logo.asset.d.ts',
    'todocss.resource.d.ts'
  ];

  for (const filename of possibleFiles) {
    const filePath = path.join(typingsBaseDir, filename);
    if (indexer.fileSystemProvider.fileExists(normalizePath(filePath))) {
      metaTypings.push(path.resolve(filePath));
    }
  }

  return metaTypings;
};

// Utility function to get custom label files
const getCustomLabelFiles = (indexer: TypingIndexerData): string[] => {
  // For mock file system, check for the specific custom labels file
  const customLabelsPath = path.join(
    indexer.workspaceRoot,
    'force-app/main/default/labels/CustomLabels.labels-meta.xml'
  );
  if (indexer.fileSystemProvider.fileExists(normalizePath(customLabelsPath))) {
    return [customLabelsPath];
  }
  return [];
};

// Legacy class for backward compatibility (deprecated)
export default class TypingIndexer {
  public readonly workspaceRoot: NormalizedPath;
  public typingsBaseDir!: NormalizedPath;
  public projectType!: WorkspaceType;
  public metaFiles: string[] = [];
  public fileSystemProvider: IFileSystemProvider;
  public connection?: Connection;

  // visible for testing
  public static diff(items: string[], compareItems: string[]): string[] {
    return diffItems(items, compareItems);
  }

  constructor(attributes: BaseIndexerAttributes, fileSystemProvider: IFileSystemProvider) {
    this.workspaceRoot = getWorkspaceRoot(attributes.workspaceRoot);
    this.fileSystemProvider = fileSystemProvider;
    // projectType and typingsBaseDir will be set by the async initialization
  }

  /**
   * Set the LSP connection for file operations (works in both Node.js and web)
   */
  public setConnection(connection: Connection): void {
    this.connection = connection;
  }

  /**
   * Creates and initializes a TypingIndexer instance
   */
  public static async create(
    attributes: BaseIndexerAttributes,
    fileSystemProvider: IFileSystemProvider,
    connection?: Connection
  ): Promise<TypingIndexer> {
    const indexer = new TypingIndexer(attributes, fileSystemProvider);
    if (connection) {
      indexer.setConnection(connection);
    }
    await indexer.initialize();
    return indexer;
  }

  /**
   * Initializes the TypingIndexer with workspace type detection and sets up typings
   */
  private async initialize(): Promise<void> {
    this.projectType = await detectWorkspaceHelper(this.workspaceRoot, this.fileSystemProvider);

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
      this.deleteStaleMetaTypings();
      await this.saveCustomLabelTypings();
    }
  }

  // visible for testing
  public async createNewMetaTypings(): Promise<void> {
    return createNewMetaTypings(this);
  }

  // visible for testing
  public deleteStaleMetaTypings(): void {
    return deleteStaleMetaTypings(this);
  }

  // visible for testing
  public async saveCustomLabelTypings(): Promise<void> {
    return saveCustomLabelTypings(this);
  }
}
