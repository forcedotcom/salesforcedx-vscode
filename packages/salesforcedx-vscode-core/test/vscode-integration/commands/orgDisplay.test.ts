/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { OrgDisplay } from '../../../src/commands';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Status', () => {
  it('Should build the source command no flag', async () => {
    const orgDisplay = new OrgDisplay();
    const displayCommand = orgDisplay.build({});
    expect(displayCommand.toCommand()).to.equal('sf org:display');
    expect(displayCommand.description).to.equal(
      nls.localize('org_display_default_text')
    );
  });
  it('Should build the source command with target-org flag', async () => {
    const orgDisplay = new OrgDisplay('--target-org');
    const displayCommand = orgDisplay.build({ username: 'test' });
    expect(displayCommand.toCommand()).to.equal(
      'sf org:display --target-org test'
    );
    expect(displayCommand.description).to.equal(
      nls.localize('org_display_username_text')
    );
  });
});
