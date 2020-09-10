/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ForceOrgListExecutor } from '../../../src/commands/forceOrgList';
import { nls } from '../../../src/messages';

describe('Force Org List', () => {
  it('Should build the list command with --clean option', async () => {
    const forceOrgList = new ForceOrgListExecutor();
    const listCommand = forceOrgList.build({});
    expect(listCommand.toCommand()).to.equal(
      'sfdx force:org:list --clean --noprompt'
    );
    expect(listCommand.description).to.equal(
      nls.localize('force_org_list_clean_text')
    );
  });
});
