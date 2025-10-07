/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import equal from 'deep-equal';
import * as jsonc from 'jsonc-parser';
import { basename, extname, join, parse, relative, resolve, dirname } from 'node:path';
import * as vscode from 'vscode';
import { TextDocument, FileEvent, FileChangeType } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { BaseWorkspaceContext } from './baseContext';

const RESOURCES_DIR = 'resources';

// Type guard for Record<string, unknown>
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const fileContainsLine = async (file: string, expectLine: string): Promise<boolean> => {
    const trimmed = expectLine.trim();
    try {
        const content = await vscode.workspace.fs.readFile(vscode.Uri.file(file)).then((data) => data.toString());
        for (const line of content.split('\n')) {
            if (line.trim() === trimmed) {
                return true;
            }
        }
    } catch {
        // File doesn't exist or can't be read
    }
    return false;
};

export const toResolvedPath = (uri: string): string => resolve(URI.parse(uri).fsPath);

const isLWCRootDirectory = (context: BaseWorkspaceContext, uri: string): boolean => {
    if (context.type === 'SFDX') {
        const file = toResolvedPath(uri);
        return file.endsWith('lwc');
    }
    return false;
};

const isAuraDirectory = (context: BaseWorkspaceContext, uri: string): boolean => {
    if (context.type === 'SFDX') {
        const file = toResolvedPath(uri);
        return file.endsWith('aura');
    }
    return false;
};

export const isLWCWatchedDirectory = async (context: BaseWorkspaceContext, uri: string): Promise<boolean> => {
    const file = toResolvedPath(uri);
    return await context.isFileInsideModulesRoots(file);
};

export const isAuraWatchedDirectory = async (context: BaseWorkspaceContext, uri: string): Promise<boolean> => {
    const file = toResolvedPath(uri);
    return await context.isFileInsideAuraRoots(file);
};

/**
 * @return true if changes include a directory delete
 */
// TODO This is not waiting for the response of the promise isLWCWatchedDirectory, maybe we have the same problem on includesDeletedAuraWatchedDirectory
export const includesDeletedLwcWatchedDirectory = async (context: BaseWorkspaceContext, changes: FileEvent[]): Promise<boolean> => {
    for (const event of changes) {
        if (event.type === FileChangeType.Deleted && !event.uri.includes('.') && (await isLWCWatchedDirectory(context, event.uri))) {
            return true;
        }
    }
    return false;
};

export const includesDeletedAuraWatchedDirectory = async (context: BaseWorkspaceContext, changes: FileEvent[]): Promise<boolean> => {
    for (const event of changes) {
        if (event.type === FileChangeType.Deleted && !event.uri.includes('.') && (await isAuraWatchedDirectory(context, event.uri))) {
            return true;
        }
    }
    return false;
};

export const containsDeletedLwcWatchedDirectory = async (context: BaseWorkspaceContext, changes: FileEvent[]): Promise<boolean> => {
    for (const event of changes) {
        const insideLwcWatchedDirectory = await isLWCWatchedDirectory(context, event.uri);
        if (event.type === FileChangeType.Deleted && insideLwcWatchedDirectory) {
            const { dir, name, ext } = parse(event.uri);
            const folder = basename(dir);
            const parentFolder = basename(dirname(dir));
            // LWC component OR folder deletion, subdirectory of lwc or lwc directory itself
            if (((ext.endsWith('.ts') || ext.endsWith('.js')) && folder === name && parentFolder === 'lwc') || (!ext && (folder === 'lwc' || name === 'lwc'))) {
                return true;
            }
        }
    }
    return false;
};

export const isLWCRootDirectoryCreated = (context: BaseWorkspaceContext, changes: FileEvent[]): boolean => {
    for (const event of changes) {
        if (event.type === FileChangeType.Created && isLWCRootDirectory(context, event.uri)) {
            return true;
        }
    }
    return false;
};

export const isAuraRootDirectoryCreated = (context: BaseWorkspaceContext, changes: FileEvent[]): boolean => {
    for (const event of changes) {
        if (event.type === FileChangeType.Created && isAuraDirectory(context, event.uri)) {
            return true;
        }
    }
    return false;
};

export const unixify = (filePath: string): string => filePath.replace(/\\/g, '/');

export const relativePath = (from: string, to: string): string => unixify(relative(from, to));

export const pathStartsWith = (path: string, root: string): boolean => {
    if (process.platform === 'win32') {
        return path.toLowerCase().startsWith(root.toLowerCase());
    }
    return path.startsWith(root);
};

export const getExtension = (textDocument: TextDocument): string => {
    const filePath = URI.parse(textDocument.uri).fsPath;
    return filePath ? extname(filePath) : '';
};

export const getBasename = (textDocument: TextDocument): string => {
    const filePath = URI.parse(textDocument.uri).fsPath;
    const ext = extname(filePath);
    return filePath ? basename(filePath, ext) : '';
};

export const getSfdxResource = (resourceName: string): string => join(__dirname, RESOURCES_DIR, 'sfdx', resourceName);

export const getCoreResource = (resourceName: string): string => join(__dirname, RESOURCES_DIR, 'core', resourceName);

export const appendLineIfMissing = async (file: string, line: string): Promise<void> => {
    const fileUri = vscode.Uri.file(file);
    try {
        await vscode.workspace.fs.stat(fileUri);
        // File exists, check if line is missing
        if (!(await fileContainsLine(file, line))) {
            const content = await vscode.workspace.fs.readFile(fileUri).then((data) => data.toString());
            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(`${content}\n${line}\n`));
        }
    } catch {
        // File doesn't exist, create it with the line
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(`${line}\n`));
    }
};

/**
 * Deep merges the 'from' object into the 'to' object
 * (assumes simple JSON config objects)
 * @return true if the 'to' object was modified, false otherwise
 */
export const deepMerge = (to: Record<string, unknown>, from: Record<string, unknown>): boolean => {
    let modified = false;
    for (const key of Object.keys(from)) {
        const fromVal = from[key];
        const toVal = Object.prototype.hasOwnProperty.call(to, key) ? to[key] : undefined;
        if (!Object.prototype.hasOwnProperty.call(to, key)) {
            // if 'to' doesn't have the property just assign the 'from' one
            to[key] = fromVal;
            modified = true;
        } else if (Array.isArray(fromVal)) {
            // assign 'from' array values to the 'to' array (create array if 'to' is a scalar)
            const toArray = Array.isArray(toVal) ? toVal : (to[key] = [toVal]);
            for (const e of fromVal) {
                if (!toArray.some((value) => equal(value, e))) {
                    toArray.push(e);
                    modified = true;
                }
            }
        } else if (Array.isArray(toVal)) {
            // if 'to' is array and 'from' scalar, push 'from' to the array
            if (!toVal.includes(fromVal)) {
                toVal.push(fromVal);
                modified = true;
            }
        } else if (isRecord(fromVal) && isRecord(toVal)) {
            // merge object values
            if (deepMerge(toVal, fromVal)) {
                modified = true;
            }
        }
        // do not overwrite existing values
    }
    return modified;
};

/**
 * @return string showing elapsed milliseconds from start mark
 */
export const elapsedMillis = (start: number): string => {
    const elapsed = globalThis.performance.now() - start;
    return `${elapsed.toFixed(2)} ms`;
};

export const memoize = <T>(fn: () => T): (() => T) => {
    let cache: T | undefined;
    return (): T => {
        if (cache !== undefined) {
            return cache;
        }
        cache = fn();
        return cache;
    };
};

export const readJsonSync = async (file: string): Promise<Record<string, unknown>> => {
    try {
        const content = await vscode.workspace.fs.readFile(vscode.Uri.file(file)).then((data) => data.toString());
        // jsonc.parse will return an object without comments.
        // Comments will be lost if this object is written back to file.
        // Individual properties should be updated directly via VS Code API to preserve comments.
        const parsed = jsonc.parse(content);
        return isRecord(parsed) ? parsed : {};
    } catch (err) {
        console.log(`onIndexCustomComponents(LOTS): Error reading jsconfig ${file}`, err);
        return {};
    }
};

export const writeJsonSync = async (file: string, json: Record<string, unknown>): Promise<void> => {
    await vscode.workspace.fs.writeFile(vscode.Uri.file(file), Buffer.from(JSON.stringify(json, null, 4)));
};
