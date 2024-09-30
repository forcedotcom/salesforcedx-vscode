/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ProjectDeployStartExecutor } from '../../../src/commands';
import { nls } from '../../../src/messages';

describe('Project Deploy Start', () => {
  const commonParams = '--json';
  it('Should build the project deploy start command with no flag', async () => {
    const projectDeployStartNoFlag = new ProjectDeployStartExecutor();
    const projectDeployStartCommand = projectDeployStartNoFlag.build({});
    expect(projectDeployStartCommand.toCommand()).to.equal(
      `sf ${projectDeployStartNoFlag.params.command} ${commonParams}`
    );
    expect(projectDeployStartCommand.description).to.equal(
      nls.localize('project_deploy_start_default_org_text')
    );
  });

  it('Should build the project deploy start command with ignore conflicts flag', async () => {
    const projectDeployStartIgnoreConflicts = new ProjectDeployStartExecutor(
      '--ignore-conflicts'
    );
    const projectDeployStartCommand = projectDeployStartIgnoreConflicts.build(
      {}
    );
    expect(projectDeployStartCommand.toCommand()).to.equal(
      `sf ${projectDeployStartIgnoreConflicts.params.command} ${commonParams} --ignore-conflicts`
    );
    expect(projectDeployStartCommand.description).to.equal(
      nls.localize('project_deploy_start_ignore_conflicts_default_org_text')
    );
  });
});
