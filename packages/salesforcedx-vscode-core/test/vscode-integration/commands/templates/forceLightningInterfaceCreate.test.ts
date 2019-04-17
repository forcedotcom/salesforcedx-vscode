/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { ForceLightningInterfaceCreateExecutor } from '../../../../src/commands/templates/forceLightningInterfaceCreate';
import { nls } from '../../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Lightning Interface Create', () => {
  it('Should build the Lightning Interface create command', async () => {
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
});
