/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ProjectRetrieveStartExecutor } from '../../../src/commands';
import { nls } from '../../../src/messages';

describe('Project Retrieve Start', () => {
  it('Should build the source pull command with the --json flag', async () => {
    const projectRetrieveStartNoFlag = new ProjectRetrieveStartExecutor();
    const projectRetrieveStartCommand = projectRetrieveStartNoFlag.build({});
    expect(projectRetrieveStartCommand.toCommand()).to.equal(
      'sf project:retrieve:start --json'
    );
    expect(projectRetrieveStartCommand.description).to.equal(
      nls.localize('project_retrieve_start_default_org_text')
    );
  });

  it('Should build the source pull command with ignore conflicts flag', async () => {
    const sourcePullOverwrite = new ProjectRetrieveStartExecutor(
      '--ignore-conflicts'
    );
    const projectRetrieveStartCommand = sourcePullOverwrite.build({});
    expect(projectRetrieveStartCommand.toCommand()).to.equal(
      'sf project:retrieve:start --json --ignore-conflicts'
    );
    expect(projectRetrieveStartCommand.description).to.equal(
      nls.localize('project_retrieve_start_ignore_conflicts_default_org_text')
    );
  });
});
