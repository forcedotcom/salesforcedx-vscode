#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import fs from 'node:fs';

// Removes all files but .jar files at the top-level
const files = fs.readdirSync('.');
files.forEach(file => {
  if (!file.match(/\.jar$/)) {
    try {
      if (fs.statSync(file).isDirectory()) {
        fs.rmSync(file, { recursive: true, force: true });
      } else {
        fs.unlinkSync(file);
      }
    } catch (err) {
      console.error(`Error removing ${file}:`, err);
    }
  }
});
