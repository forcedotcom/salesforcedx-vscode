/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SalesforceOrgDataSource } from './salesforceOrgDataSource.js';
import { createSoqlBuilderServer } from './server.js';
import { parseServerOptions } from './serverOptions.js';

const options = parseServerOptions(process.argv.slice(2));
const server = createSoqlBuilderServer(new SalesforceOrgDataSource(options.targetOrg));

server.listen(options.port, '127.0.0.1', () => {
  console.log(`SOQL Builder web example listening at http://127.0.0.1:${options.port} using org ${options.targetOrg}`);
});
