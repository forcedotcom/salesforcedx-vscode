/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:no-unused-expression

import { expect } from 'chai';
import { Application } from 'spectron';

describe('Test', () => {
  describe('Spectron', async function(this) {
    const app = new Application({
      path: '/Applications/Visual Studio Code.app/Contents/MacOS/Electron',
      args: [
        '--skip-getting-started',
        '--extensions-dir=/Users/james.sweetman/development/salesforcedx-vscode/packages'
      ],
      chromeDriverArgs: ['user-data-dir=test_data/temp_user_dir'],
      startTimeout: 10000
    });

    before(async () => await app.start());
    after(async () => await app.stop());

    it('Shows an initial window', async () => {
      const count = await app.client.getWindowCount();
      expect(count).to.equal(1);
    });
  });
});
