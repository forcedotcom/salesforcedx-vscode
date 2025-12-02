/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from 'vscode-languageserver';

/**
 * Intercepts global console logging methods and redirects them to the LSP connection.
 * This allows language server log messages to appear in the client's output panel
 * (e.g., VS Code's Output view) instead of the server's local console.
 *
 * This provides a centralized logging solution - once called, any code in the language
 * server can use console.log(), console.error(), etc., and the messages will automatically
 * appear in the client's output channel without needing to pass the connection object around.
 *
 * @param connection - The LSP connection to redirect console output to
 */
export const interceptConsoleLogger = (connection: Connection): void => {
  const console: any = global.console;
  if (!console) {
    return;
  }
  const intercept = (method: string): void => {
    const original = console[method];
    console[method] = (...args: any[]): void => {
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
