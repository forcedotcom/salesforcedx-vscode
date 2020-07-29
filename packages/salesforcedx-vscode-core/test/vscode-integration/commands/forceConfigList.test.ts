/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ForceConfigList } from '../../../src/commands';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Config List', () => {
  it('Should build the config list command', async () => {
    const configList = new ForceConfigList();
    const configListCommand = configList.build({});
    expect(configListCommand.toCommand()).to.equal('sfdx force:config:list');
    expect(configListCommand.description).to.equal(
      nls.localize('force_config_list_text')
    );
  });
});
