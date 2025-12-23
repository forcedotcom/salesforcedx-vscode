/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isAbsolute } from 'node:path';
import * as vscode from 'vscode';

expect.extend({
    toExist: async (path: string) => {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(path));
            return {
                message: () => `expected ${path} not to exist`,
                pass: true,
            };
        } catch {
            return {
                message: () => `expected ${path} to exist`,
                pass: false,
            };
        }
    },
    toBeAbsolutePath: (path: string) => {
        const pass = isAbsolute(path);
        if (pass) {
            return {
                message: () => `expected ${path} not to be absolute`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${path} to be absolute`,
                pass: false,
            };
        }
    },
});
