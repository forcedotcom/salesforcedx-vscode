/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';
import { ForceLightningAppCreateExecutor } from '../../../../src/commands/templates/forceLightningAppCreate';
import { nls } from '../../../../src/messages';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';

// tslint:disable:no-unused-expression
describe('Force Lightning App Create', () => {
  let settings: SinonStub;

  beforeEach(() => {
    settings = stub(SfdxCoreSettings.prototype, 'getInternalDev');
  });

  afterEach(() => {
    settings.restore();
  });

  it('Should build the lightning app create command', async () => {
    settings.returns(false);
    const lightningAppCreate = new ForceLightningAppCreateExecutor();
    const outputDirPath = path.join('force-app', 'main', 'default', 'aura');
    const fileName = 'lightningApp';
    const lightningAppCreateCommand = lightningAppCreate.build({
      fileName,
      outputdir: outputDirPath
    });
    expect(lightningAppCreateCommand.toCommand()).to.equal(
      `sfdx force:lightning:app:create --appname ${fileName} --outputdir ${outputDirPath}`
    );
    expect(lightningAppCreateCommand.description).to.equal(
      nls.localize('force_lightning_app_create_text')
    );
    expect(lightningAppCreate.getDefaultDirectory()).to.equal('aura');
    expect(lightningAppCreate.getFileExtension()).to.equal('.app');
    expect(
      lightningAppCreate.sourcePathStrategy.getPathToSource(
        outputDirPath,
        fileName,
        '.app'
      )
    ).to.equal(path.join(outputDirPath, fileName, `${fileName}.app`));
  });

  it('Should build the internal lightning app create command', async () => {
    settings.returns(true);
    const lightningAppCreate = new ForceLightningAppCreateExecutor();
    const outputDirPath = path.join('non-dx', 'dir', 'components', 'ns');
    const fileName = 'lightningInternalApp';
    const lightningAppCreateCommand = lightningAppCreate.build({
      fileName,
      outputdir: outputDirPath
    });
    expect(lightningAppCreateCommand.toCommand()).to.equal(
      `sfdx force:lightning:app:create --appname ${fileName} --outputdir ${outputDirPath} --internal`
    );
    expect(lightningAppCreateCommand.description).to.equal(
      nls.localize('force_lightning_app_create_text')
    );
    expect(lightningAppCreate.getDefaultDirectory()).to.equal('aura');
    expect(lightningAppCreate.getFileExtension()).to.equal('.app');
    expect(
      lightningAppCreate.sourcePathStrategy.getPathToSource(
        outputDirPath,
        fileName,
        '.app'
      )
    ).to.equal(path.join(outputDirPath, fileName, `${fileName}.app`));
  });
});
