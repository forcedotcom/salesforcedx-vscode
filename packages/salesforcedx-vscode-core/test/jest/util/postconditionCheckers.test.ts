/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import * as fs from 'fs';
import { join } from 'path';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { OverwriteComponentPrompt } from '../../../src/commands/util';
import { notificationService } from '../../../src/notifications';
import { workspaceUtils } from '../../../src/util';

describe('Postcondition Checkers', () => {
  let env: SinonSandbox;

  describe('OverwriteComponentPrompt', () => {
    let existsStub: SinonStub;
    let modalStub: SinonStub;
    let promptStub: SinonStub;
    const checker = new OverwriteComponentPrompt();

    beforeEach(() => {
      env = createSandbox();
      existsStub = env.stub(fs, 'existsSync');
      modalStub = env.stub(notificationService, 'showWarningModal');
    });

    afterEach(() => env.restore());

    describe('Check Components Exist', () => {
      beforeEach(() => {
        promptStub = env.stub(checker, 'promptOverwrite');
      });

      it('Should prompt overwrite for LightningType components that exist', async () => {
        existsStub.returns(false);
        const data = {
          fileName: 'Test1',
          outputdir: 'package/tests',
          type: 'LightningTypeBundle',
          suffix: 'json'
        };
        pathExists(true, data, '/schema.json');
        await checker.check({ type: 'CONTINUE', data });
        expect(promptStub.firstCall.args[0]).to.eql([data]);
      });

      it('Should prompt overwrite for LightningType components that does not exist', async () => {
        existsStub.returns(false);
        const data = {
          fileName: 'Test1',
          outputdir: 'package/tests',
          type: 'LightningTypeBundle',
          suffix: 'json'
        };
        await checker.check({ type: 'CONTINUE', data });
        expect(promptStub.firstCall).to.null;
      });
    });

    const pathExists = (value: boolean, forComponent: LocalComponent, withExtension: string) => {
      const path = join(
        workspaceUtils.getRootWorkspacePath(),
        `package/tests/${forComponent.fileName}${withExtension}`
      );
      existsStub.withArgs(path).returns(value);
    };
  });
});
