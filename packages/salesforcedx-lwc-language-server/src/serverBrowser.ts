/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Browser entry point for the language server
// Uses vscode-languageserver/browser which works with web workers
import Server from './lwcServerBrowser';

// Log that the server module is loading (this will appear in web worker console)
console.log('[LWC Server] Server module loading...');

const server = new Server();
console.log('[LWC Server] Server instance created, starting listen...');
server.listen();
console.log('[LWC Server] Server.listen() called - server should be ready');
