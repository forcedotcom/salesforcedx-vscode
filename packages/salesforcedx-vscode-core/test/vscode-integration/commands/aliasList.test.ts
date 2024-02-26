/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { AliasList } from '../../../src/commands';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Alias List', () => {
  it('Should build the alias list command', async () => {
    const aliasList = new AliasList();
    const aliasListCommand = aliasList.build({});
    expect(aliasListCommand.toCommand()).to.equal('sf alias:list');
    expect(aliasListCommand.description).to.equal(
      nls.localize('alias_list_text')
    );
  });
});
