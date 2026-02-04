import * as fs from 'fs';
import * as path from 'path';

/** Generates the entry point that re-exports only the public API type */
const generateEntry = (): void => {
  const srcDir = path.join(__dirname, '..', 'src');
  const entryPath = path.join(srcDir, 'index.ts');

  // Create src directory if it doesn't exist
  fs.mkdirSync(srcDir, { recursive: true });

  // Generate minimal entry point that only exports the public API
  const content = `/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This file is auto-generated. Do not edit manually.
export type { SalesforceVSCodeServicesApi } from '../../salesforcedx-vscode-services/out/src/index';
`;

  fs.writeFileSync(entryPath, content, 'utf8');
  console.log('Generated entry point at', entryPath);
};

generateEntry();
