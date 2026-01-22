/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createConnection, Connection } from 'vscode-languageserver/node';

import { BaseServer } from './baseServer';

export default class Server extends BaseServer {
  protected createConnection(): Connection {
    return createConnection();
  }
}

// Re-export for tests
export { findDynamicContent } from './baseServer';
