/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';
import { ForceLightningInterfaceCreateExecutor } from '../../../../src/commands/templates/forceLightningInterfaceCreate';
import { nls } from '../../../../src/messages';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';

// tslint:disable:no-unused-expression
describe('Force Lightning Interface Create', () => {
  let settings: SinonStub;

  beforeEach(() => {
    settings = stub(SfdxCoreSettings.prototype, 'getInternalDev');
  });

  afterEach(() => {
    settings.restore();
  });

  it('Should build the Lightning Interface create command', async () => {
    settings.returns(false);
    const lightningInterfaceCreate = new ForceLightningInterfaceCreateExecutor();
    const outputDirPath = path.join('force-app', 'main', 'default', 'aura');
    const fileName = 'myAuraInterface';
    const lwcCreateCommand = lightningInterfaceCreate.build({
      fileName,
      outputdir: outputDirPath
    });
    expect(lwcCreateCommand.toCommand()).to.equal(
      `sfdx force:lightning:interface:create --interfacename ${fileName} --outputdir ${outputDirPath}`
    );
    expect(lwcCreateCommand.description).to.equal(
      nls.localize('force_lightning_interface_create_text')
    );
    expect(lightningInterfaceCreate.getDefaultDirectory()).to.equal('aura');
    expect(lightningInterfaceCreate.getFileExtension()).to.equal('.intf');
    expect(
      lightningInterfaceCreate.sourcePathStrategy.getPathToSource(
        outputDirPath,
        fileName,
        '.intf'
      )
    ).to.equal(path.join(outputDirPath, fileName, `${fileName}.intf`));
  });

  it('Should build the internal Lightning Interface create command', async () => {
    settings.returns(true);
    const lightningInterfaceCreate = new ForceLightningInterfaceCreateExecutor();
    const outputDirPath = path.join('non-dx', 'dir', 'components', 'ns');
    const fileName = 'internalInterface';
    const lwcCreateCommand = lightningInterfaceCreate.build({
      fileName,
      outputdir: outputDirPath
    });
    expect(lwcCreateCommand.toCommand()).to.equal(
      `sfdx force:lightning:interface:create --interfacename ${fileName} --outputdir ${outputDirPath} --internal`
    );
    expect(lwcCreateCommand.description).to.equal(
      nls.localize('force_lightning_interface_create_text')
    );
    expect(lightningInterfaceCreate.getDefaultDirectory()).to.equal('aura');
    expect(lightningInterfaceCreate.getFileExtension()).to.equal('.intf');
    expect(
      lightningInterfaceCreate.sourcePathStrategy.getPathToSource(
        outputDirPath,
        fileName,
        '.intf'
      )
    ).to.equal(path.join(outputDirPath, fileName, `${fileName}.intf`));
  });
});
