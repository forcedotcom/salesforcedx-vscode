/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import * as vscode from 'vscode';

export const folderExists = async (folderPath: string): Promise<boolean> => {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(folderPath));
    return true;
  } catch (e) {
    console.error('Error checking folder existence:', e);
    return false;
  }
};

export const createDirectory = async (dirPath: string): Promise<void> => {
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));
};

export const writeFile = async (filePath: string, content: string): Promise<void> => {
  try {
    // Ensure the directory exists
    const dirPath = path.dirname(filePath);
    if (!(await folderExists(dirPath))) {
      await createDirectory(dirPath);
    }

    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(content);
    await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), uint8Array);
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
    throw error;
  }
};

export const deleteFile = async (
  filePath: string,
  options: { recursive?: boolean; useTrash?: boolean } = {}
): Promise<void> => {
  await vscode.workspace.fs.delete(vscode.Uri.file(filePath), options);
};

export const readFile = async (filePath: string): Promise<string> => {
  const content = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
  return Buffer.from(content).toString('utf8');
};
