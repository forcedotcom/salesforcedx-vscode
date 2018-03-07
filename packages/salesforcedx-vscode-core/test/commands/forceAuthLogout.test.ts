/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ForceAuthLogoutAll } from '../../src/commands/forceAuthLogout';
import { nls } from '../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Auth Logout All', () => {
  it('Should build the auth logout all command', async () => {
    const authLogoutAll = new ForceAuthLogoutAll();
    const authLogoutAllCommand = authLogoutAll.build({});
    expect(authLogoutAllCommand.toCommand()).to.equal(
      'sfdx force:auth:logout --all --noprompt'
    );
    expect(authLogoutAllCommand.description).to.equal(
      nls.localize('force_auth_logout_all_text')
    );
  });
});
