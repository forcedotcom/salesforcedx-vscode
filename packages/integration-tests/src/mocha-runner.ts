/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import * as path from 'path';
import Mocha = require('mocha');

const mocha = new Mocha({ ui: 'bdd', timeout: 360000, slow: 5000 });
mocha.useColors(true);

// Add the integration tests here
mocha.addFile(
  path.join(process.cwd(), 'out', 'scenarios', 'scaffolding.test.js')
);

mocha.run(failures => {
  process.exit(failures);
});
