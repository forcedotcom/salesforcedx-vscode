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
  ForceOrgCreateExecutor
} from '../../../src/commands/forceOrgCreate';
import { nls } from '../../../src/messages';
import { getRootWorkspacePath } from '../../../src/util';

// tslint:disable:no-unused-expression
describe('Force Org Create', () => {
  describe('Alias Gatherer', () => {
    const EVENT_CANCEL = 'CANCEL';
    const EVENT_CONTINUE = 'CONTINUE';
    const TEST_ALIAS = 'testAlias';
    const TEST_WORKSPACE = 'sfdxsimple'; // FYI: This test uses the workspace created by the system tests to run
    const TEST_ORG_EXPIRATION_DAYS = '7';
    const TEST_ORG_EXPIRATION_DAYS_PLUS_ONE_DAY = '8';
    const TEST_ORG_EXPIRATION_DAYS_INPUT_FLOAT = '8.2';
    const TEST_ORG_EXPIRATION_DAYS_INPUT_INVALID_RANGE = '31';
    let inputBoxSpy: sinon.SinonStub;

    beforeEach(() => {
      inputBoxSpy = sinon.stub(vscode.window, 'showInputBox');
    });

    afterEach(() => {
      inputBoxSpy.restore();
    });

    it('Should return cancel if alias is undefined', async () => {
      inputBoxSpy.onCall(0).returns(undefined);
      const gatherer = new AliasGatherer();
      const response = await gatherer.gather();
      expect(inputBoxSpy.callCount).to.equal(1);
      expect(response.type).to.equal(EVENT_CANCEL);
    });

    it('Should return Continue with default alias if user input is empty string', async () => {
      inputBoxSpy.onCall(0).returns('');
      inputBoxSpy.onCall(1).returns(TEST_ORG_EXPIRATION_DAYS);
      const gatherer = new AliasGatherer();
      const response = await gatherer.gather();
      expect(inputBoxSpy.callCount).to.equal(2);
      if (response.type === EVENT_CONTINUE) {
        expect(response.data.alias).to.equal(TEST_WORKSPACE);
        expect(response.data.expirationDays).to.equal(TEST_ORG_EXPIRATION_DAYS);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });

    it('Should return Continue with inputted alias if user input is not undefined or empty', async () => {
      inputBoxSpy.onCall(0).returns(TEST_ALIAS);
      inputBoxSpy.onCall(1).returns(TEST_ORG_EXPIRATION_DAYS_PLUS_ONE_DAY);
      const gatherer = new AliasGatherer();
      const response = await gatherer.gather();
      expect(inputBoxSpy.callCount).to.equal(2);
      expect(response.type).to.equal(EVENT_CONTINUE);
      if (response.type === EVENT_CONTINUE) {
        expect(response.data.alias).to.equal(TEST_ALIAS);
        expect(response.data.expirationDays).to.equal(
          TEST_ORG_EXPIRATION_DAYS_PLUS_ONE_DAY
        );
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });

    it('Should return Cancel since the user canceled (pressed ESC) the process when defining the expiration for the scratch org', async () => {
      inputBoxSpy.onCall(0).returns(TEST_ALIAS);
      inputBoxSpy.onCall(1).returns(undefined);
      const gatherer = new AliasGatherer();
      const response = await gatherer.gather();
      expect(inputBoxSpy.callCount).to.equal(2);
      expect(response.type).to.equal(EVENT_CANCEL);
    });
  });

  describe('Org Create Builder', () => {
    it('Should build the org create command', async () => {
      const CONFIG_FILE = 'configFile.txt';
      const TEST_ALIAS = 'testAlias';
      const TEST_ORG_EXPIRATION_DAYS = '7';
      const forceOrgCreateBuilder = new ForceOrgCreateExecutor();
      const createCommand = forceOrgCreateBuilder.build({
        file: path.join(getRootWorkspacePath(), CONFIG_FILE),
        alias: TEST_ALIAS,
        expirationDays: TEST_ORG_EXPIRATION_DAYS
      });
      expect(createCommand.toCommand()).to.equal(
        `sfdx force:org:create -f ${CONFIG_FILE} --setalias ${TEST_ALIAS} --durationdays ${TEST_ORG_EXPIRATION_DAYS} --setdefaultusername --json --loglevel fatal`
      );
      expect(createCommand.description).to.equal(
        nls.localize('force_org_create_default_scratch_org_text')
      );
    });
  });
});
