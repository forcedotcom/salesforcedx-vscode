/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ForceApexTriggerCreateExecutor } from '../../../src/commands/templates/forceApexTriggerCreate';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Apex Trigger Create', () => {
  it('Should build the apex trigger create command', async () => {
    const triggerCreate = new ForceApexTriggerCreateExecutor();
    const triggerCreateCommand = triggerCreate.build({
      fileName: 'myTrigger',
      outputdir: 'force-app/main/default/trigger'
    });
    expect(triggerCreateCommand.toCommand()).to.equal(
      'sfdx force:apex:trigger:create --triggername myTrigger --outputdir force-app/main/default/trigger'
    );
    expect(triggerCreateCommand.description).to.equal(
      nls.localize('force_apex_trigger_create_text')
    );
  });
});
