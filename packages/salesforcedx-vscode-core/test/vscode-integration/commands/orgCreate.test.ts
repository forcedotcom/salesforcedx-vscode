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
import { AliasGatherer, OrgCreateExecutor } from '../../../src/commands';
import { nls } from '../../../src/messages';
import { workspaceUtils } from '../../../src/util';

describe('Org Create', () => {
  describe('Alias Gatherer', () => {
    const EVENT_CANCEL = 'CANCEL';
    const EVENT_CONTINUE = 'CONTINUE';
    const TEST_ALIAS = 'testAlias';
    const TEST_WORKSPACE = 'sfsimple'; // FYI: This test uses the workspace created by the system tests to run
    const TEST_ORG_EXPIRATION_DAYS = '7';
    const TEST_ORG_EXPIRATION_DAYS_PLUS_ONE_DAY = '8';
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

    it('Should consider an empty string as valid input for the alias', async () => {
      inputBoxSpy.onCall(0).returns('');
      inputBoxSpy.onCall(1).returns('');
      await new AliasGatherer().gather();
      const opts = inputBoxSpy.getCall(0).args[0] as vscode.InputBoxOptions;
      if (opts.validateInput) {
        expect(opts.validateInput('')).to.be.null;
      } else {
        expect.fail('Alias input should have a validate function');
      }
    });

    it('Should consider an empty string as valid input for the expiration days', async () => {
      inputBoxSpy.onCall(0).returns('');
      inputBoxSpy.onCall(1).returns('');
      await new AliasGatherer().gather();
      const opts = inputBoxSpy.getCall(1).args[0] as vscode.InputBoxOptions;
      if (opts.validateInput) {
        expect(opts.validateInput('')).to.be.null;
      } else {
        expect.fail('Expiration days input should have a validate function');
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
        expect(response.data.expirationDays).to.equal(TEST_ORG_EXPIRATION_DAYS_PLUS_ONE_DAY);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });

    it('Should return Continue with default scratch org expiration days if input is empty string', async () => {
      inputBoxSpy.onCall(0).returns(TEST_ALIAS);
      inputBoxSpy.onCall(1).returns('');
      const gatherer = new AliasGatherer();
      const response = await gatherer.gather();
      expect(inputBoxSpy.callCount).to.equal(2);
      if (response.type === EVENT_CONTINUE) {
        expect(response.data.expirationDays).to.equal(TEST_ORG_EXPIRATION_DAYS);
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
      const forceOrgCreateBuilder = new OrgCreateExecutor();
      const createCommand = forceOrgCreateBuilder.build({
        file: path.join(workspaceUtils.getRootWorkspacePath(), CONFIG_FILE),
        alias: TEST_ALIAS,
        expirationDays: TEST_ORG_EXPIRATION_DAYS
      });
      expect(createCommand.toCommand()).to.equal(
        `sf org:create:scratch --definition-file ${CONFIG_FILE} --alias ${TEST_ALIAS} --duration-days ${TEST_ORG_EXPIRATION_DAYS} --set-default --json`
      );
      expect(createCommand.description).to.equal(nls.localize('org_create_default_scratch_org_text'));
    });
  });
});
