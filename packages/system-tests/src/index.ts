/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';

export function deactivate() {
  if (process.env.COLLECT_COVERAGE) {
    console.log('System tests unloading...');
    const coverage = (global as any).__coverage__;
    if (coverage) {
      const coverageFolder = path.join(__dirname, '..', '..', 'coverage', `${new Date().getTime()}`);
      fs.mkdirSync(coverageFolder, { recursive: true });
      const writeStream = fs.createWriteStream(path.join(coverageFolder, 'coverage.json'));
      writeStream.write(JSON.stringify(coverage));
      writeStream.end();
    }
  }
}
