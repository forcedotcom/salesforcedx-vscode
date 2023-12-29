/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { LightningGenerateTestExecutor } from '../../../../src/commands/templates';
import { nls } from '../../../../src/messages';
import { workspaceUtils } from '../../../../src/util';

describe('Lightning Web Component Generate Test', () => {
  it('Should build the Lightning Web Component Test create command', async () => {
    const lightningGenerateTest = new LightningGenerateTestExecutor();
    const outputDirPath = path.join('force-app', 'main', 'default', 'lwc');
    const fileName = 'testing';
    const lwcCreateTestCommand = lightningGenerateTest.build({
      fileName,
      outputdir: path.join(outputDirPath, 'testing')
    });
    const fullFilepath = path.join(
      workspaceUtils.getRootWorkspacePath(),
      outputDirPath,
      'testing',
      fileName + '.js'
    );

    if (fullFilepath) {
      expect(lwcCreateTestCommand.toCommand()).to.equal(
        `sfdx lightning:generate:test --filepath ${fullFilepath}`
      );
      expect(lwcCreateTestCommand.description).to.equal(
        nls.localize('lightning_generate_test_text')
      );
      expect(lightningGenerateTest.getDefaultDirectory()).to.equal('lwc');
      expect(lightningGenerateTest.getFileExtension()).to.equal('.js');
      expect(
        lightningGenerateTest
          .getSourcePathStrategy()
          .getPathToSource(path.join(outputDirPath, 'testing'), fileName, '.js')
      ).to.equal(
        path.join(outputDirPath, fileName, '__tests__', `${fileName}.test.js`)
      );
    }
  });
});
