/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import * as glob from 'glob';
import * as path from 'path';
import Mocha = require('mocha');

const mocha = new Mocha({
  ui: 'bdd',
  timeout: 360000,
  slow: 5000,
  reporter: 'mocha-multi-reporters',
  reporterOptions: {
    reporterEnabled: 'mocha-junit-reporter, xunit, spec',
    mochaJunitReporterReporterOptions: {
      mochaFile: 'junit-custom.xml'
    },
    xunitReporterOptions: {
      output: 'xunit.xml'
    }
  }
});
mocha.useColors(true);

const files = glob.sync('out/**/*.test.js', { cwd: process.cwd() });
files.forEach(f => mocha.addFile(path.join(process.cwd(), f)));

mocha.run(failures => {
  process.exit(failures);
});
