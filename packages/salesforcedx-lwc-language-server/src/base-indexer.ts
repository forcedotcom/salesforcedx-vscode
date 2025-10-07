/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

// Utility function to resolve workspace root
export const getWorkspaceRoot = (workspaceRoot: string): string => path.resolve(workspaceRoot);

// Utility function to get SFDX configuration
export const getSfdxConfig = (root: string): any => {
    const filename: string = path.join(root, 'sfdx-project.json');
    const data: string = fs.readFileSync(filename).toString();
    return JSON.parse(data);
};

// Utility function to get SFDX package directories pattern
export const getSfdxPackageDirsPattern = (workspaceRoot: string): string => {
    const dirs = getSfdxConfig(workspaceRoot).packageDirectories;
    const paths: string[] = dirs.map((item: { path: string }): string => item.path);
    return paths.length === 1 ? paths[0] : `{${paths.join()}}`;
};
