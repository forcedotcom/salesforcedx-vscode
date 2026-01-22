/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Browser entry point for the language server
// Uses vscode-languageserver/browser which works with web workers
import Server from './lwcServerBrowser';

const server = new Server();
server.listen();
