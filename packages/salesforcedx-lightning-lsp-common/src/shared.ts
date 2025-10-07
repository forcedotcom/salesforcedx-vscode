/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import * as vscode from 'vscode';

const SFDX_PROJECT = 'sfdx-project.json';

export type WorkspaceType = 'STANDARD' | 'STANDARD_LWC' | 'MONOREPO' | 'MONOREPO_LWC' | 'SFDX' | 'CORE_ALL' | 'CORE_PARTIAL' | 'UNKNOWN';

export const isLWC = (type: WorkspaceType): boolean => type === 'SFDX' || type === 'STANDARD_LWC' || type === 'CORE_ALL' || type === 'CORE_PARTIAL';

export const getSfdxProjectFile = (root: string): string => path.join(root, SFDX_PROJECT);

/**
 * @param root
 * @returns WorkspaceType for singular root
 */
export const detectWorkspaceHelper = async (root: string): Promise<WorkspaceType> => {
    try {
        const sfdxProjectUri = vscode.Uri.file(getSfdxProjectFile(root));
        await vscode.workspace.fs.stat(sfdxProjectUri);
        return 'SFDX';
    } catch {
        // File doesn't exist, continue
    }

    try {
        const workspaceUserUri = vscode.Uri.file(path.join(root, 'workspace-user.xml'));
        await vscode.workspace.fs.stat(workspaceUserUri);
        return 'CORE_ALL';
    } catch {
        // File doesn't exist, continue
    }

    try {
        const parentWorkspaceUserUri = vscode.Uri.file(path.join(root, '..', 'workspace-user.xml'));
        await vscode.workspace.fs.stat(parentWorkspaceUserUri);
        return 'CORE_PARTIAL';
    } catch {
        // File doesn't exist, continue
    }

    try {
        const lwcConfigUri = vscode.Uri.file(path.join(root, 'lwc.config.json'));
        await vscode.workspace.fs.stat(lwcConfigUri);
        return 'STANDARD_LWC';
    } catch {
        // File doesn't exist, continue
    }

    const packageJson = path.join(root, 'package.json');
    try {
        const packageJsonUri = vscode.Uri.file(packageJson);
        await vscode.workspace.fs.stat(packageJsonUri);

        const packageInfo = JSON.parse(await vscode.workspace.fs.readFile(packageJsonUri).then((data) => data.toString()));
        const dependencies = Object.keys(packageInfo.dependencies ?? {});
        const devDependencies = Object.keys(packageInfo.devDependencies ?? {});
        const allDependencies = [...dependencies, ...devDependencies];
        const hasLWCdependencies = allDependencies.some((key) => key.startsWith('@lwc/') || key === 'lwc');

        // any type of @lwc is a dependency
        if (hasLWCdependencies) {
            return 'STANDARD_LWC';
        }

        // has any type of lwc configuration
        if (packageInfo.lwc) {
            return 'STANDARD_LWC';
        }

        if (packageInfo.workspaces) {
            return 'MONOREPO';
        }

        try {
            const lernaJsonUri = vscode.Uri.file(path.join(root, 'lerna.json'));
            await vscode.workspace.fs.stat(lernaJsonUri);
            return 'MONOREPO';
        } catch {
            // File doesn't exist, continue
        }

        return 'STANDARD';
    } catch (e) {
        // Log error and fallback to setting workspace type to Unknown
        console.error(`Error encountered while trying to detect workspace type ${e}`);
    }

    console.error('unknown workspace type:', root);
    return 'UNKNOWN';
};

/**
 * @param workspaceRoots
 * @returns WorkspaceType, actively not supporting workspaces of mixed type
 */
export const detectWorkspaceType = async (workspaceRoots: string[]): Promise<WorkspaceType> => {
    if (workspaceRoots.length === 1) {
        return await detectWorkspaceHelper(workspaceRoots[0]);
    }
    for (const root of workspaceRoots) {
        const type = await detectWorkspaceHelper(root);
        if (type !== 'CORE_PARTIAL') {
            console.error('unknown workspace type');
            return 'UNKNOWN';
        }
    }
    return 'CORE_PARTIAL';
};
