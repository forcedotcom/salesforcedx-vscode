/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';
import { ForceLightningLwcCreateExecutor } from '../../../../src/commands/templates/forceLightningLwcCreate';
import { ForceLightningLwcTestCreateExecutor } from '../../../../src/commands/templates/forceLightningLwcTestCreate';
import { nls } from '../../../../src/messages';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';
import { getRootWorkspacePath } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('Force Lightning Web Component Test Create', () => {
  let settings: SinonStub;

  beforeEach(() => {
    settings = stub(SfdxCoreSettings.prototype, 'getInternalDev');
  });

  afterEach(() => {
    settings.restore();
  });

  it('Should build the Lightning Web Component Test create command', async () => {
    settings.returns(false);
    const lightningLWCTestCreate = new ForceLightningLwcTestCreateExecutor();
    const outputDirPath = path.join('force-app', 'main', 'default', 'lwc');
    const fileName = 'testing';
    const lwcCreateTestCommand = lightningLWCTestCreate.build({
      fileName,
      outputdir: outputDirPath
    });
    const fullFilepath = path.join(
      getRootWorkspacePath(),
      outputDirPath,
      fileName + '.js'
    );
    expect(lwcCreateTestCommand.toCommand()).to.equal(
      `sfdx force:lightning:lwc:test:create --filename ${fullFilepath}`
    );
    expect(lwcCreateTestCommand.description).to.equal(
      nls.localize('force_lightning_lwc_create_text')
    );
    expect(lightningLWCTestCreate.getDefaultDirectory()).to.equal('lwc');
    expect(lightningLWCTestCreate.getFileExtension()).to.equal('.js');
    expect(
      lightningLWCTestCreate
        .getSourcePathStrategy()
        .getPathToSource(outputDirPath, fileName, '.js')
    ).to.equal(path.join(outputDirPath, fileName, `${fileName}.js`));
  });
});
