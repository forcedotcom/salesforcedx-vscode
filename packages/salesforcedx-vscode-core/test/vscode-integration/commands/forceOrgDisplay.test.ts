/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ForceOrgDisplay } from '../../../src/commands';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Source Status', () => {
  it('Should build the source command no flag', async () => {
    const forceOrgDisplay = new ForceOrgDisplay();
    const displayCommand = forceOrgDisplay.build({});
    expect(displayCommand.toCommand()).to.equal('sfdx force:org:display');
    expect(displayCommand.description).to.equal(
      nls.localize('force_org_display_default_text')
    );
  });
  it('Should build the source command with targetusername flag', async () => {
    const forceOrgDisplay = new ForceOrgDisplay('--targetusername');
    const displayCommand = forceOrgDisplay.build({ username: 'test' });
    expect(displayCommand.toCommand()).to.equal(
      'sfdx force:org:display --targetusername test'
    );
    expect(displayCommand.description).to.equal(
      nls.localize('force_org_display_username_text')
    );
  });
});
