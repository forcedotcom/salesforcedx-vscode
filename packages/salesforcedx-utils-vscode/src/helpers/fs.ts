/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { dirname, join } from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';

export const readFile = async (filePath: string): Promise<string> => {
  try {
    const uri = URI.file(filePath);
    const data = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(data).toString('utf8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Writes content to a file
 * @param filePath The path to the file
 * @param content The content to write
 */
export const writeFile = async (filePath: string, content: string): Promise<void> => {
  try {
    const dirPath = dirname(filePath);
    await createDirectory(dirPath);

    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(content);
    await vscode.workspace.fs.writeFile(URI.file(filePath), uint8Array);
  } catch (error) {
    throw new Error(`Failed to write file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Checks if a file exists
 * @param filePath The path to the file
 * @returns True if the file exists, false otherwise
 */
export const fileOrFolderExists = async (filePath: string): Promise<boolean> => {
  try {
    const uri = URI.file(filePath);
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
};

/**
 * Checks if a path is a directory
 * @param path The path to check
 * @returns True if the path exists and is a directory, false otherwise
 */
export const isDirectory = async (path: string): Promise<boolean> => {
  try {
    const uri = URI.file(path);
    const fileStat = await vscode.workspace.fs.stat(uri);
    return fileStat.type === vscode.FileType.Directory;
  } catch {
    return false;
  }
};

/**
 * Checks if a path is a file
 * @param path The path to check
 * @returns True if the path exists and is a file, false otherwise
 */
export const isFile = async (path: string): Promise<boolean> => {
  try {
    const uri = URI.file(path);
    const fileStat = await vscode.workspace.fs.stat(uri);
    return fileStat.type === vscode.FileType.File;
  } catch {
    return false;
  }
};

/**
 * Creates a directory recursively.  Will not throw if the directory already exists.
 * @param dirPath The path to the directory
 */
export const createDirectory = async (dirPath: string): Promise<void> => {
  try {
    const uri = URI.file(dirPath);
    await vscode.workspace.fs.createDirectory(uri);
  } catch (error) {
    throw new Error(`Failed to create directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Deletes a file
 * @param filePath The path to the file
 */
export const deleteFile = async (
  filePath: string,
  options: { recursive?: boolean; useTrash?: boolean } = {}
): Promise<void> => {
  try {
    const uri = URI.file(filePath);
    await vscode.workspace.fs.delete(uri, options);
  } catch (error) {
    throw new Error(`Failed to delete file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Reads a directory's contents
 * @param dirPath The path to the directory
 * @returns Array of file/directory names
 */
export const readDirectory = async (dirPath: string): Promise<string[]> => {
  try {
    const uri = URI.file(dirPath);
    const entries = await vscode.workspace.fs.readDirectory(uri);
    return entries.map(([name]) => name);
  } catch (error) {
    throw new Error(`Failed to read directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Gets file stats
 * @param filePath The path to the file
 * @returns File stats including size, creation time, and modification time
 */
export const stat = async (filePath: string): Promise<vscode.FileStat> => {
  try {
    const uri = URI.file(filePath);
    return await vscode.workspace.fs.stat(uri);
  } catch (error) {
    throw new Error(
      `Failed to get file stats for ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

export const safeDelete = async (
  filePath: string,
  options?: { recursive?: boolean; useTrash?: boolean }
): Promise<void> => {
  try {
    const uri = URI.file(filePath);
    await vscode.workspace.fs.stat(uri);
    await vscode.workspace.fs.delete(uri, options);
  } catch {
    // File doesn't exist or can't be accessed, do nothing
  }
};

/**
 * Ensures the current working directory is set to the project path
 * @param rootWorkspacePath The path to the root workspace
 */
export const ensureCurrentWorkingDirIsProjectPath = async (rootWorkspacePath: string): Promise<void> => {
  if (rootWorkspacePath && process.cwd() !== rootWorkspacePath) {
    try {
      const uri = URI.file(rootWorkspacePath);
      await vscode.workspace.fs.stat(uri);
      process.chdir(rootWorkspacePath);
    } catch {
      // Path doesn't exist, do nothing
    }
  }
};

/**
 * Renames or moves a file or directory
 * @param oldPath The current path of the file or directory
 * @param newPath The new path for the file or directory
 */
export const rename = async (oldPath: string, newPath: string): Promise<void> => {
  try {
    const oldUri = URI.file(oldPath);
    const newUri = URI.file(newPath);
    await vscode.workspace.fs.rename(oldUri, newUri);
  } catch (error) {
    throw new Error(
      `Failed to rename ${oldPath} to ${newPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Checks if a directory is empty or contains only empty subdirectories (async, uses fs utils)
 */
export const isEmptyDirectory = async (dirPath: string): Promise<boolean> => {
  try {
    const items = await readDirectory(dirPath);
    if (items.length === 0) {
      return true;
    }
    for (const item of items) {
      const itemPath = join(dirPath, item);
      if (!(await isFile(itemPath))) {
        return false; // Found a file, directory is not empty
      }
      if ((await isDirectory(itemPath)) && !(await isEmptyDirectory(itemPath))) {
        return false; // Found a non-empty subdirectory
      }
    }
    return true;
  } catch {
    // If we can't read the directory, assume it's not empty
    return false;
  }
};
