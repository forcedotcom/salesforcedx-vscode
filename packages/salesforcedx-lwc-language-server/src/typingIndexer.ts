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
import { getSfdxPackageDirsPattern } from './baseIndexer';
import { fromMeta, declarationsFromCustomLabels, getDeclaration } from './typing';

const basenameRegex = new RegExp(/(?<name>[\w-_]+)\.[^/]+$/);

// visible for testing
export const pathBasename = (filename: string): string => {
  const parsedPath = path.parse(filename).base;
  const match = basenameRegex.exec(parsedPath);
  return match?.groups?.name ?? '';
};

export type TypingIndexerData = {
  workspaceRoot: NormalizedPath;
  typingsBaseDir: NormalizedPath;
  projectType: WorkspaceType;
  fileSystemAccessor: LspFileSystemAccessor;
};

export const diffItems = (items: string[], compareItems: string[]): string[] => {
  const compareBasenames = new Set(compareItems.map(pathBasename));
  return items.filter(item => !compareBasenames.has(pathBasename(item)));
};

export const getMetaFiles = async (indexer: TypingIndexerData): Promise<string[]> => {
  const packageDirsPattern = await getSfdxPackageDirsPattern(indexer.workspaceRoot, indexer.fileSystemAccessor);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  return await indexer.fileSystemAccessor.findFilesWithGlobAsync(
    `${packageDirsPattern}/**/{staticresources,contentassets,messageChannels}/*.{resource,asset,messageChannel}-meta.xml`,
    indexer.workspaceRoot
  );
};

export const getMetaTypings = async (indexer: TypingIndexerData): Promise<string[]> =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  await indexer.fileSystemAccessor
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    .findFilesWithGlobAsync('*.{messageChannel,resource,asset}.d.ts', indexer.typingsBaseDir)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
    .then(paths => paths.map(p => path.resolve(p)));

export const createNewMetaTypings = async (indexer: TypingIndexerData): Promise<void> => {
  const newFiles = diffItems(await getMetaFiles(indexer), await getMetaTypings(indexer));
  for (const filename of newFiles) {
    const typing = fromMeta(filename);
    const uri = path.join(indexer.typingsBaseDir, typing.fileName);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await indexer.fileSystemAccessor.updateFileContent(uri, getDeclaration(typing));
  }
};

export const deleteStaleMetaTypings = async (indexer: TypingIndexerData): Promise<void> => {
  const staleTypings = diffItems(await getMetaTypings(indexer), await getMetaFiles(indexer));
  const filesToDelete: string[] = [];
  for (const filename of staleTypings) {
    const uri = normalizePath(filename);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (await indexer.fileSystemAccessor.fileExists(uri)) {
      filesToDelete.push(uri);
    }
  }
  for (const pathToDelete of filesToDelete) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await indexer.fileSystemAccessor.deleteFile(pathToDelete);
  }
};

export const saveCustomLabelTypings = async (indexer: TypingIndexerData): Promise<void> => {
  const customLabelFiles = await getCustomLabelFiles(indexer);
  const typings: string[] = [];
  for (const filename of customLabelFiles) {
    const uri = normalizePath(filename);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (await indexer.fileSystemAccessor.fileExists(uri)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
      const content = await indexer.fileSystemAccessor.getFileContent(uri);
      if (content) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const data = Buffer.from(content, 'utf8');

        typings.push(await declarationsFromCustomLabels(data));
      }
    }
  }
  const fileContent = typings.join('\n');
  if (fileContent.length > 0) {
    const customLabelTypingsPath = normalizePath(
      path.join(indexer.workspaceRoot, '.sfdx', 'typings', 'lwc', 'customlabels.d.ts')
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await indexer.fileSystemAccessor.updateFileContent(customLabelTypingsPath, fileContent);
  }
};

const getCustomLabelFiles = async (indexer: TypingIndexerData): Promise<string[]> => {
  const packageDirsPattern = await getSfdxPackageDirsPattern(indexer.workspaceRoot, indexer.fileSystemAccessor);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  return await indexer.fileSystemAccessor.findFilesWithGlobAsync(
    `${packageDirsPattern}/**/labels/CustomLabels.labels-meta.xml`,
    indexer.workspaceRoot
  );
};

/** Detects workspace type, sets up the typings directory, and runs the initial indexing pass
 * for SFDX workspaces. Returns undefined for workspace types without a typings directory. */
export const initializeTypings = async (
  workspaceRoot: NormalizedPath,
  fileSystemAccessor: LspFileSystemAccessor
): Promise<TypingIndexerData | undefined> => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const projectType = await detectWorkspaceHelper(workspaceRoot, fileSystemAccessor);

  let typingsBaseDir: NormalizedPath;
  switch (projectType) {
    case 'SFDX':
      typingsBaseDir = normalizePath(path.join(workspaceRoot, '.sfdx', 'typings', 'lwc'));
      break;
    case 'CORE_PARTIAL':
      typingsBaseDir = normalizePath(path.join(workspaceRoot, '..', '.vscode', 'typings', 'lwc'));
      break;
    case 'CORE_ALL':
      typingsBaseDir = normalizePath(path.join(workspaceRoot, '.vscode', 'typings', 'lwc'));
      break;
    default:
      return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const data: TypingIndexerData = { workspaceRoot, typingsBaseDir, projectType, fileSystemAccessor };

  if (projectType === 'SFDX') {
    await createNewMetaTypings(data);
    await deleteStaleMetaTypings(data);
    await saveCustomLabelTypings(data);
  }

  return data;
};
