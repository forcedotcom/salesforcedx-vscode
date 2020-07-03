/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ForceConfigSetExecutor } from '../../../src/commands';
import { nls } from '../../../src/messages';

describe('Force Config Set', () => {
  it('should build the force config set command', async () => {
    const usernameOrAlias = 'test-username1@gmail.com';
    const forceConfigSet = new ForceConfigSetExecutor(usernameOrAlias);
    const forceConfigSetCommand = forceConfigSet.build({});
    expect(forceConfigSetCommand.toCommand()).to.equal(
      `sfdx force:config:set defaultusername=${usernameOrAlias}`
    );
    expect(forceConfigSetCommand.description).to.equal(
      nls.localize('force_config_set_org_text')
    );
  });
});
