/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import * as vscode from 'vscode';

/**
 * Check if a directory contains module roots
 */
const isModuleRoot = async (subdirs: string[]): Promise<boolean> => {
    for (const subdir of subdirs) {
        // Is a root if any subdir matches a name/name.js with name.js being a module
        const basename = path.basename(subdir);
        const modulePath = path.join(subdir, `${basename}.js`);
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(modulePath));
            // TODO: check contents for: from 'lwc'?
            return true;
        } catch {
            // File doesn't exist
        }
    }
    return false;
};

/**
 * Recursively traverse directories to find namespace roots
 */
const traverse = async (candidate: string, depth: number, roots: { lwc: string[]; aura: string[] }): Promise<void> => {
    if (depth - 1 < 0) {
        return;
    }

    // skip traversing node_modules and similar
    const filename = path.basename(candidate);
    if (['node_modules', 'bin', 'target', 'jest-modules', 'repository', 'git'].includes(filename)) {
        return;
    }

    // module_root/name/name.js
    const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(candidate));
    const dirs = [];
    for (const [name, type] of entries) {
        if (type === vscode.FileType.Directory) {
            dirs.push(path.join(candidate, name));
        }
    }

    // Is a root if we have a folder called lwc
    const isDirLWC = (await isModuleRoot(dirs)) || (!path.parse(candidate).ext && path.parse(candidate).name === 'lwc');
    if (isDirLWC) {
        roots.lwc.push(path.resolve(candidate));
    } else {
        for (const subdir of dirs) {
            await traverse(subdir, depth, roots);
        }
    }
};

/**
 * Helper function to find namespace roots within a directory
 */
export const findNamespaceRoots = async (root: string, maxDepth = 5): Promise<{ lwc: string[]; aura: string[] }> => {
    const roots: { lwc: string[]; aura: string[] } = {
        lwc: [],
        aura: [],
    };

    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(root));
        await traverse(root, maxDepth, roots);
    } catch {
        // Directory doesn't exist
    }
    return roots;
};
