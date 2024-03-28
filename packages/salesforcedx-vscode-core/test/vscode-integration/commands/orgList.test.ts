/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { OrgListExecutor } from '../../../src/commands/orgList';
import { nls } from '../../../src/messages';

describe('Org List', () => {
  it('Should build the list command with --clean option', async () => {
    const orgList = new OrgListExecutor();
    const listCommand = orgList.build({});
    expect(listCommand.toCommand()).to.equal('sf org:list --clean --no-prompt');
    expect(listCommand.description).to.equal(
      nls.localize('org_list_clean_text')
    );
  });
});
