/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { ForceVisualForceComponentCreateExecutor } from '../../../../src/commands/templates/forceVisualforceComponentCreate';
import { nls } from '../../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Visualforce Component Create', () => {
  it('Should build the Visualforce component create command', async () => {
    const visualforceCmpCreate = new ForceVisualForceComponentCreateExecutor();
    const outputDirPath = path.join(
      'force-app',
      'main',
      'default',
      'components'
    );
    const fileName = 'myVFCmp';
    const vfCmpCreateCommand = visualforceCmpCreate.build({
      fileName,
      outputdir: outputDirPath,
      type: 'ApexComponent'
    });
    expect(vfCmpCreateCommand.toCommand()).to.equal(
      `sfdx force:visualforce:component:create --componentname ${fileName} --label ${fileName} --outputdir ${outputDirPath}`
    );
    expect(vfCmpCreateCommand.description).to.equal(
      nls.localize('force_visualforce_component_create_text')
    );
    expect(visualforceCmpCreate.getDefaultDirectory()).to.equal('components');
    expect(visualforceCmpCreate.getFileExtension()).to.equal('.component');
    expect(
      visualforceCmpCreate.sourcePathStrategy.getPathToSource(
        outputDirPath,
        fileName,
        '.component'
      )
    ).to.equal(path.join(outputDirPath, `${fileName}.component`));
  });
});
