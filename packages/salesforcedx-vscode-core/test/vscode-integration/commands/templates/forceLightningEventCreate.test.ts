/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { ForceLightningEventCreateExecutor } from '../../../../src/commands/templates/forceLightningEventCreate';
import { nls } from '../../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Lightning Event Create', () => {
  it('Should build the Lightning Event create command', async () => {
    const lightningEventCreate = new ForceLightningEventCreateExecutor();
    const outputDirPath = path.join('force-app', 'main', 'default', 'aura');
    const fileName = 'myAuraEvent';
    const lwcCreateCommand = lightningEventCreate.build({
      fileName,
      outputdir: outputDirPath
    });
    expect(lwcCreateCommand.toCommand()).to.equal(
      `sfdx force:lightning:event:create --eventname ${fileName} --outputdir ${outputDirPath}`
    );
    expect(lwcCreateCommand.description).to.equal(
      nls.localize('force_lightning_event_create_text')
    );
    expect(lightningEventCreate.getDefaultDirectory()).to.equal('aura');
    expect(lightningEventCreate.getFileExtension()).to.equal('.evt');
    expect(
      lightningEventCreate.sourcePathStrategy.getPathToSource(
        outputDirPath,
        fileName,
        '.evt'
      )
    ).to.equal(path.join(outputDirPath, fileName, `${fileName}.evt`));
  });
});
