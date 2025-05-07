/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

export const folderExists = async (path: string): Promise<boolean> => {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(path));
    return true;
  } catch (e) {
    console.error('Error checking folder existence:', e);
    return false;
  }
};

export const createDirectory = async (path: string): Promise<void> => {
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(path));
};

export const writeFile = async (path: string, content: string): Promise<void> => {
  await vscode.workspace.fs.writeFile(vscode.Uri.file(path), Buffer.from(content, 'utf8'));
};

export const deleteFile = async (
  path: string,
  options: { recursive?: boolean; useTrash?: boolean } = {}
): Promise<void> => {
  await vscode.workspace.fs.delete(vscode.Uri.file(path), options);
};

export const readFile = async (path: string): Promise<string> => {
  const content = await vscode.workspace.fs.readFile(vscode.Uri.file(path));
  return Buffer.from(content).toString('utf8');
};
