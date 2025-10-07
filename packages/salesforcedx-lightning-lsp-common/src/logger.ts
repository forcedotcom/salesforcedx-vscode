/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { IConnection } from 'vscode-languageserver';

/**
 * Intercepts global console logging methods and redirects them to the LSP connection.
 * This allows language server log messages to appear in the client's output panel
 * (e.g., VS Code's Output view) instead of the server's local console.
 *
 * @param connection - The LSP connection to redirect console output to
 */
export const interceptConsoleLogger = (connection: IConnection): void => {
    const console: any = global.console;
    if (!console) {
        return;
    }
    const intercept = (method: string): void => {
        const original = console[method];
        console[method] = function (...args: any): void {
            if (connection) {
                const remote: any = connection.console;
                remote[method].apply(connection.console, args);
            } else {
                original.apply(console, args);
            }
        };
    };
    const methods = ['log', 'info', 'warn', 'error'];
    for (const method of methods) {
        intercept(method);
    }
};
