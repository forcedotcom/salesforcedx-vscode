/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { extname, join, resolve } from 'node:path';
import * as vscode from 'vscode';
import { TextDocument } from 'vscode-languageserver';
import { URI } from 'vscode-uri';

export const FORCE_APP_ROOT = join('test-workspaces', 'sfdx-workspace', 'force-app', 'main', 'default');
export const UTILS_ROOT = join('test-workspaces', 'sfdx-workspace', 'utils', 'meta');
export const REGISTERED_EMPTY_FOLDER_ROOT = join('test-workspaces', 'sfdx-workspace', 'registered-empty-folder', 'meta');
export const CORE_ALL_ROOT = join('test-workspaces', 'core-like-workspace', 'app', 'main', 'core');
export const CORE_PROJECT_ROOT = join(CORE_ALL_ROOT, 'ui-global-components');
export const CORE_MULTI_ROOT = [join(CORE_ALL_ROOT, 'ui-force-components'), join(CORE_ALL_ROOT, 'ui-global-components')];

const languageId = (path: string): string => {
    const suffix = extname(path);
    if (!suffix) {
        return '';
    }
    switch (suffix.substring(1)) {
        case 'js':
            return 'javascript';
        case 'html':
            return 'html';
        case 'app':
        case 'cmp':
            return 'html'; // aura cmps
    }
    throw new Error(`todo: ${path}`);
};

export const readAsTextDocument = async (path: string): Promise<TextDocument> => {
    const uri = URI.file(resolve(path)).toString();
    const content = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(path))).toString('utf-8');
    return TextDocument.create(uri, languageId(path), 0, content);
};
