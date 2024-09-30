/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable-next-line:no-var-requires
// tslint:disable-next-line:variable-name
import * as Mocha from 'mocha';

// You can directly control Mocha options by uncommenting the following lines
// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info

const mocha = new Mocha({
  ui: 'bdd',
  timeout: 100000
});
mocha.useColors(true);

module.exports = mocha;
