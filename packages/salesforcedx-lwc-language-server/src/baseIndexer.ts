/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import * as vscode from 'vscode';

// Utility function to resolve workspace root
export const getWorkspaceRoot = (workspaceRoot: string): string => path.resolve(workspaceRoot);

// Utility function to get SFDX configuration
export const getSfdxConfig = async (root: string): Promise<any> => {
    const filename: string = path.join(root, 'sfdx-project.json');
    const fileBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(filename));
    const data: string = Buffer.from(fileBuffer).toString('utf8');

    return JSON.parse(data);
};

// Utility function to get SFDX package directories pattern
export const getSfdxPackageDirsPattern = async (workspaceRoot: string): Promise<string> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const config = await getSfdxConfig(workspaceRoot);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const dirs = config.packageDirectories;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const paths: string[] = dirs.map((item: { path: string }): string => item.path);
    return paths.length === 1 ? paths[0] : `{${paths.join()}}`;
};
