/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { ForceApexClassCreateExecutor } from '../../../../src/commands/templates/forceApexClassCreate';
import { nls } from '../../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Apex Class Create', () => {
  it('Should build the apex class create command', async () => {
    const classCreate = new ForceApexClassCreateExecutor();
    const outputDirPath = path.join('force-app', 'main', 'default', 'classes');
    const fileName = 'myClass';
    const classCreateCommand = classCreate.build({
      fileName,
      outputdir: outputDirPath
    });
    expect(classCreateCommand.toCommand()).to.equal(
      `sfdx force:apex:class:create --classname ${fileName} --template DefaultApexClass --outputdir ${outputDirPath}`
    );
    expect(classCreateCommand.description).to.equal(
      nls.localize('force_apex_class_create_text')
    );
    expect(classCreate.getDefaultDirectory()).to.equal('classes');
    expect(classCreate.getFileExtension()).to.equal('.cls');
    expect(
      classCreate
        .getSourcePathStrategy()
        .getPathToSource(outputDirPath, fileName, '.cls')
    ).to.equal(path.join(outputDirPath, `${fileName}.cls`));
  });
});
