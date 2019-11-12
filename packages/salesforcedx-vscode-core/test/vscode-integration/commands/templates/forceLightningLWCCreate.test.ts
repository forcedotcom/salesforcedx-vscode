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
import { nls } from '../../../../src/messages';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';

// tslint:disable:no-unused-expression
describe('Force Lightning Web Component Create', () => {
  let settings: SinonStub;

  beforeEach(() => {
    settings = stub(SfdxCoreSettings.prototype, 'getInternalDev');
  });

  afterEach(() => {
    settings.restore();
  });

  it('Should build the Lightning Web Component create command', async () => {
    settings.returns(false);
    const lightningLWCCreate = new ForceLightningLwcCreateExecutor();
    const outputDirPath = path.join('force-app', 'main', 'default', 'lwc');
    const fileName = 'myLWC';
    const lwcCreateCommand = lightningLWCCreate.build({
      fileName,
      outputdir: outputDirPath
    });
    expect(lwcCreateCommand.toCommand()).to.equal(
      `sfdx force:lightning:component:create --type lwc --componentname ${fileName} --outputdir ${outputDirPath}`
    );
    expect(lwcCreateCommand.description).to.equal(
      nls.localize('force_lightning_lwc_create_text')
    );
    expect(lightningLWCCreate.getDefaultDirectory()).to.equal('lwc');
    expect(lightningLWCCreate.getFileExtension()).to.equal('.js');
    expect(
      lightningLWCCreate
        .getSourcePathStrategy()
        .getPathToSource(outputDirPath, fileName, '.js')
    ).to.equal(path.join(outputDirPath, fileName, `${fileName}.js`));
  });

  it('Should build the internal Lightning Web Component create command', async () => {
    settings.returns(true);
    const lightningLWCCreate = new ForceLightningLwcCreateExecutor();
    const outputDirPath = path.join('non-dx', 'dir', 'components', 'ns');
    const fileName = 'internalLWC';
    const lwcCreateCommand = lightningLWCCreate.build({
      fileName,
      outputdir: outputDirPath
    });
    expect(lwcCreateCommand.toCommand()).to.equal(
      `sfdx force:lightning:component:create --type lwc --componentname ${fileName} --outputdir ${outputDirPath} --internal`
    );
    expect(lwcCreateCommand.description).to.equal(
      nls.localize('force_lightning_lwc_create_text')
    );
    expect(lightningLWCCreate.getDefaultDirectory()).to.equal('lwc');
    expect(lightningLWCCreate.getFileExtension()).to.equal('.js');
    expect(
      lightningLWCCreate
        .getSourcePathStrategy()
        .getPathToSource(outputDirPath, fileName, '.js')
    ).to.equal(path.join(outputDirPath, fileName, `${fileName}.js`));
  });
});
