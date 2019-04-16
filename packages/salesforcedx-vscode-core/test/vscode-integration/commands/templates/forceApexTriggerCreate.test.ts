/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { ForceApexTriggerCreateExecutor } from '../../../../src/commands/templates/forceApexTriggerCreate';
import { nls } from '../../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Apex Trigger Create', () => {
  it('Should build the apex trigger create command', async () => {
    const triggerCreate = new ForceApexTriggerCreateExecutor();
    const outputDirPath = path.join('force-app', 'main', 'default', 'triggers');
    const fileName = 'myTrigger';
    const triggerCreateCommand = triggerCreate.build({
      fileName,
      outputdir: outputDirPath
    });
    expect(triggerCreateCommand.toCommand()).to.equal(
      `sfdx force:apex:trigger:create --triggername ${fileName} --outputdir ${outputDirPath}`
    );
    expect(triggerCreateCommand.description).to.equal(
      nls.localize('force_apex_trigger_create_text')
    );
    expect(triggerCreate.getDefaultDirectory()).to.equal('triggers');
    expect(triggerCreate.getFileExtension()).to.equal('.trigger');
    expect(
      triggerCreate.sourcePathStrategy.getPathToSource(
        outputDirPath,
        fileName,
        '.trigger'
      )
    ).to.equal(path.join(outputDirPath, `${fileName}.trigger`));
  });
});
