/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { ForceLightningAppCreateExecutor } from '../../../../src/commands/templates/forceLightningAppCreate';
import { nls } from '../../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Lightning App Create', () => {
  it('Should build the lightning app create command', async () => {
    const lightningAppCreate = new ForceLightningAppCreateExecutor();
    const outputDirPath = path.join('force-app', 'main', 'default', 'aura');
    const lightningAppCreateCommand = lightningAppCreate.build({
      fileName: 'lightningApp',
      outputdir: outputDirPath
    });
    expect(lightningAppCreateCommand.toCommand()).to.equal(
      `sfdx force:lightning:app:create --appname lightningApp --outputdir ${outputDirPath}`
    );
    expect(lightningAppCreateCommand.description).to.equal(
      nls.localize('force_lightning_app_create_text')
    );
    expect(lightningAppCreate.getDefaultDirectory()).to.equal('aura');
    expect(lightningAppCreate.getFileExtension()).to.equal('.app');
  });
});
