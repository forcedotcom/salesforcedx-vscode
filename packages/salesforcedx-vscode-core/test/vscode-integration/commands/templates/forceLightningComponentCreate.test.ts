/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';
import { ForceLightningComponentCreateExecutor } from '../../../../src/commands/templates/forceLightningComponentCreate';
import { nls } from '../../../../src/messages';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';

// tslint:disable:no-unused-expression
describe('Force Lightning Component Create', () => {
  let settings: SinonStub;

  beforeEach(() => {
    settings = stub(SfdxCoreSettings.prototype, 'getInternalDev');
  });

  afterEach(() => {
    settings.restore();
  });

  it('Should build the Lightning Component create command', async () => {
    settings.returns(false);
    const lightningCmpCreate = new ForceLightningComponentCreateExecutor();
    const outputDirPath = path.join('force-app', 'main', 'default', 'aura');
    const fileName = 'myAuraCmp';
    const lwcCreateCommand = lightningCmpCreate.build({
      fileName,
      outputdir: outputDirPath
    });
    expect(lwcCreateCommand.toCommand()).to.equal(
      `sfdx force:lightning:component:create --componentname ${fileName} --outputdir ${outputDirPath}`
    );
    expect(lwcCreateCommand.description).to.equal(
      nls.localize('force_lightning_component_create_text')
    );
    expect(lightningCmpCreate.getDefaultDirectory()).to.equal('aura');
    expect(lightningCmpCreate.getFileExtension()).to.equal('.cmp');
    expect(
      lightningCmpCreate
        .getSourcePathStrategy()
        .getPathToSource(outputDirPath, fileName, '.cmp')
    ).to.equal(path.join(outputDirPath, fileName, `${fileName}.cmp`));
  });

  it('Should build the internal Lightning Component create command', async () => {
    settings.returns(true);
    const lightningCmpCreate = new ForceLightningComponentCreateExecutor();
    const outputDirPath = path.join('non-dx', 'dir', 'components', 'ns');
    const fileName = 'internalCmp';
    const lwcCreateCommand = lightningCmpCreate.build({
      fileName,
      outputdir: outputDirPath
    });
    expect(lwcCreateCommand.toCommand()).to.equal(
      `sfdx force:lightning:component:create --componentname ${fileName} --outputdir ${outputDirPath} --internal`
    );
    expect(lwcCreateCommand.description).to.equal(
      nls.localize('force_lightning_component_create_text')
    );
    expect(lightningCmpCreate.getDefaultDirectory()).to.equal('aura');
    expect(lightningCmpCreate.getFileExtension()).to.equal('.cmp');
    expect(
      lightningCmpCreate
        .getSourcePathStrategy()
        .getPathToSource(outputDirPath, fileName, '.cmp')
    ).to.equal(path.join(outputDirPath, fileName, `${fileName}.cmp`));
  });
});
