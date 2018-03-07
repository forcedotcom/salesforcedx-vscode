/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  AliasGatherer,
  DEFAULT_ALIAS,
  ForceOrgCreateExecutor
} from '../../src/commands/forceOrgCreate';
import { nls } from '../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Org Create', () => {
  describe('Alias Gatherer', () => {
    const TEST_ALIAS = 'testAlias';
    let inputBoxSpy: sinon.SinonStub;

    before(() => {
      inputBoxSpy = sinon.stub(vscode.window, 'showInputBox');
      inputBoxSpy.onCall(0).returns(undefined);
      inputBoxSpy.onCall(1).returns('');
      inputBoxSpy.onCall(2).returns(TEST_ALIAS);
    });

    after(() => {
      inputBoxSpy.restore();
    });

    it('Should return cancel if alias is undefined', async () => {
      const gatherer = new AliasGatherer();
      const response = await gatherer.gather();
      expect(inputBoxSpy.calledOnce).to.be.true;
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return Continue with default alias if user input is empty string', async () => {
      const gatherer = new AliasGatherer();
      const response = await gatherer.gather();
      expect(inputBoxSpy.calledTwice).to.be.true;
      if (response.type === 'CONTINUE') {
        expect(response.data.alias).to.equal(DEFAULT_ALIAS);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });

    it('Should return Continue with inputted alias if user input is not undefined or empty', async () => {
      const gatherer = new AliasGatherer();
      const response = await gatherer.gather();
      expect(inputBoxSpy.calledThrice).to.be.true;
      if (response.type === 'CONTINUE') {
        expect(response.data.alias).to.equal(TEST_ALIAS);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });
  });

  describe('Org Create Builder', () => {
    it('Should build the org create command', async () => {
      const CONFIG_FILE = 'configFile.txt';
      const TEST_ALIAS = 'testAlias';
      const forceOrgCreateBuilder = new ForceOrgCreateExecutor();
      const createCommand = forceOrgCreateBuilder.build({
        file: path.join(vscode.workspace.rootPath!, CONFIG_FILE),
        alias: TEST_ALIAS
      });
      expect(createCommand.toCommand()).to.equal(
        `sfdx force:org:create -f ${CONFIG_FILE} --setalias ${TEST_ALIAS} --setdefaultusername`
      );
      expect(createCommand.description).to.equal(
        nls.localize('force_org_create_default_scratch_org_text')
      );
    });
  });
});
