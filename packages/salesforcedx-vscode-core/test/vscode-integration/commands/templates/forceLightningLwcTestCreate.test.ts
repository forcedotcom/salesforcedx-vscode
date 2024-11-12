/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { ForceLightningLwcTestCreateExecutor } from '../../../../src/commands/templates';
import { nls } from '../../../../src/messages';
import { workspaceUtils } from '../../../../src/util';

describe('Force Lightning Web Component Test Create', () => {
  it('Should build the Lightning Web Component Test create command', async () => {
    const lightningLWCTestCreate = new ForceLightningLwcTestCreateExecutor();
    const outputDirPath = path.join('force-app', 'main', 'default', 'lwc');
    const fileName = 'testing';
    const lwcCreateTestCommand = lightningLWCTestCreate.build({
      fileName,
      outputdir: path.join(outputDirPath, 'testing')
    });
    const fullFilepath = path.join(workspaceUtils.getRootWorkspacePath(), outputDirPath, 'testing', fileName + '.js');

    if (fullFilepath) {
      expect(lwcCreateTestCommand.toCommand()).to.equal(
        `sf force:lightning:lwc:test:create --filepath ${fullFilepath}`
      );
      expect(lwcCreateTestCommand.description).to.equal(nls.localize('force_lightning_lwc_test_create_text'));
      expect(lightningLWCTestCreate.getDefaultDirectory()).to.equal('lwc');
      expect(lightningLWCTestCreate.getFileExtension()).to.equal('.js');
      expect(
        lightningLWCTestCreate
          .getSourcePathStrategy()
          .getPathToSource(path.join(outputDirPath, 'testing'), fileName, '.js')
      ).to.equal(path.join(outputDirPath, fileName, '__tests__', `${fileName}.test.js`));
    }
  });
});
