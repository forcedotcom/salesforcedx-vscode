/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { getExecutor, OrgOpenContainerExecutor, OrgOpenExecutor } from '../../../src/commands';
import { nls } from '../../../src/messages';

describe('Org Open', () => {
  it('should build the org open command', () => {
    const orgOpenContainer = new OrgOpenExecutor();
    const orgOpenCommand = orgOpenContainer.build({});

    expect(orgOpenCommand.toCommand()).to.equal('sf org:open');
    expect(orgOpenCommand.description).to.equal(nls.localize('org_open_default_scratch_org_text'));
  });

  it('should build the org open command for use in a container', () => {
    const orgOpenContainer = new OrgOpenContainerExecutor();
    const orgOpenCommand = orgOpenContainer.build({});

    expect(orgOpenCommand.toCommand()).to.equal('sf org:open --url-only --json');
    expect(orgOpenCommand.description).to.equal(nls.localize('org_open_default_scratch_org_text'));
  });

  describe('Executor is chosen based on environment', () => {
    afterEach(() => {
      delete process.env.SF_CONTAINER_MODE;
    });
    it('should use OrgOpenExecutor if container mode is not defined', () => {
      expect(getExecutor()).to.be.instanceOf(OrgOpenExecutor);
    });
    it('should use OrgOpenExecutor if container mode is empty', () => {
      process.env.SF_CONTAINER_MODE = '';
      expect(getExecutor()).to.be.instanceOf(OrgOpenExecutor);
    });

    it('should use OrgOpenContainerExecutor if container mode is defined', () => {
      process.env.SF_CONTAINER_MODE = 'true';
      expect(getExecutor()).to.be.instanceOf(OrgOpenContainerExecutor);
    });
  });
});
