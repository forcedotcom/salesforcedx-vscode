/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';

export type FsProvider = vscode.FileSystemProvider & {
  /** Find files by glob. baseUri optional via RelativePattern; when absent, uses workspace folder. */
  findFiles: (
    include: vscode.GlobPattern,
    exclude?: vscode.GlobPattern | null,
    maxResults?: number,
    token?: vscode.CancellationToken
  ) => Promise<URI[]>;
  /** does not exist in the vscode.FileSystemProvider but super handy so I added it*/
  exists: (uri: URI) => boolean;
};

type SerializedFile = vscode.FileStat & {
  type: vscode.FileType.File;
  data: string;
};

type SerializedDirectory = vscode.FileStat & {
  type: vscode.FileType.Directory;
  entries: Record<string, SerializedEntry>;
};

type SerializedEntry = SerializedFile | SerializedDirectory;

export const isSerializedDirectoryWithPath = (entry: SerializedEntryWithPath): entry is SerializedDirectoryWithPath =>
  entry.type === vscode.FileType.Directory;

export type SerializedFileWithPath = SerializedFile & { path: string };
type SerializedDirectoryWithPath = SerializedDirectory & {
  path: string;
};
export type SerializedEntryWithPath = SerializedFileWithPath | SerializedDirectoryWithPath;

export const isSerializedFileWithPath = (entry: SerializedEntryWithPath): entry is SerializedFileWithPath =>
  entry.type === vscode.FileType.File;
