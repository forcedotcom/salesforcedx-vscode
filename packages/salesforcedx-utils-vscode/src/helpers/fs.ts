/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isError } from 'effect/Predicate';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';

export const readFile = async (filePath: string): Promise<string> => {
  try {
    const uri = URI.file(filePath);
    const data = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(data).toString('utf8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${isError(error) ? error.message : String(error)}`);
  }
};

export const fileOrFolderExists = async (filePath: string): Promise<boolean> => {
  try {
    const uri = URI.file(filePath);
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
};
