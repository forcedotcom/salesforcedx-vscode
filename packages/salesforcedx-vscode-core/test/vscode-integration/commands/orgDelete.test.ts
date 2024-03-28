/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { OrgDeleteExecutor } from '../../../src/commands/orgDelete';
import { nls } from '../../../src/messages';

describe('Org Delete', () => {
  it('Should build the delete command with no flag', async () => {
    const orgDelete = new OrgDeleteExecutor();
    const deleteCommand = orgDelete.build({});
    expect(deleteCommand.toCommand()).to.equal(
      'sf org:delete:scratch --no-prompt'
    );
    expect(deleteCommand.description).to.equal(
      nls.localize('org_delete_default_text')
    );
  });

  it('Should build the delete command with target-org flag', async () => {
    const orgDelete = new OrgDeleteExecutor('--target-org');
    const deleteCommand = orgDelete.build({ username: 'test' });
    expect(deleteCommand.toCommand()).to.equal(
      'sf org:delete:scratch --no-prompt --target-org test'
    );
    expect(deleteCommand.description).to.equal(
      nls.localize('org_delete_username_text')
    );
  });
});
