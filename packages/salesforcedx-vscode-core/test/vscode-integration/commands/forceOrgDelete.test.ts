/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { ForceOrgDeleteExecutor } from '../../../src/commands/forceOrgDelete';
import { nls } from '../../../src/messages';

describe('Force Org Delete', () => {
  it('Should build the delete command with no flag', async () => {
    const forceOrgDelete = new ForceOrgDeleteExecutor();
    const deleteCommand = forceOrgDelete.build({});
    expect(deleteCommand.toCommand()).to.equal(
      'sfdx force:org:delete --noprompt'
    );
    expect(deleteCommand.description).to.equal(
      nls.localize('force_org_delete_default_text')
    );
  });

  it('Should build the delete command with targetusername flag', async () => {
    const forceOrgDelete = new ForceOrgDeleteExecutor('--targetusername');
    const deleteCommand = forceOrgDelete.build({ username: 'test' });
    expect(deleteCommand.toCommand()).to.equal(
      'sfdx force:org:delete --noprompt --targetusername test'
    );
    expect(deleteCommand.description).to.equal(
      nls.localize('force_org_delete_username_text')
    );
  });
});
