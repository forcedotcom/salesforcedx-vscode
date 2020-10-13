/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ForceSandboxCloneExecutor, SandboxCloneGatherer } from '../../../src/commands';
import { DEFAULT_WAIT_TIME_MINS } from '../../../src/commands/forceSandboxCreate';
import { nls } from '../../../src/messages';
import { getRootWorkspacePath } from '../../../src/util';

// tslint:disable:no-unused-expression
describe('Force Sandbox Clone', () => {
  describe('Sandbox clone parameters gatherer', () => {
    const EVENT_CANCEL = 'CANCEL';
    const EVENT_CONTINUE = 'CONTINUE';
    const TEST_ALIAS = 'testAlias';
    const TEST_WORKSPACE = 'sfdxsimple'; // FYI: This test uses the workspace created by the system tests to run
    const WAIT_TIME_IN_MINS = '2';
    const SOURCE_SANDBOX_NAME = 'sourceSandbox';
    const SANDBOX_NAME = 'destinationSandbox';

    let inputBoxSpy: sinon.SinonStub;

    beforeEach(() => {
      inputBoxSpy = sinon.stub(vscode.window, 'showInputBox');
    });

    afterEach(() => {
      inputBoxSpy.restore();
    });

    it('Should return cancel if alias is undefined', async () => {
      inputBoxSpy.onCall(0).returns(SOURCE_SANDBOX_NAME);
      inputBoxSpy.onCall(1).returns(SANDBOX_NAME);
      inputBoxSpy.onCall(2).returns(undefined);
      const gatherer = new SandboxCloneGatherer();
      const response = await gatherer.gather();
      expect(inputBoxSpy.callCount).to.equal(3);
      expect(response.type).to.equal(EVENT_CANCEL);
    });

    it('Should consider an empty string as valid input for the alias', async () => {
      inputBoxSpy.onCall(0).returns(SOURCE_SANDBOX_NAME);
      inputBoxSpy.onCall(1).returns(SANDBOX_NAME);
      inputBoxSpy.onCall(2).returns('');
      await new SandboxCloneGatherer().gather();
      const opts = inputBoxSpy.getCall(2).args[0] as vscode.InputBoxOptions;
      if (opts.validateInput) {
        expect(opts.validateInput('')).to.be.null;
      } else {
        expect.fail('Alias input should have a validate function');
      }
    });

    it('Should return Continue with default wait time if input is empty string', async () => {
      inputBoxSpy.onCall(0).returns(SOURCE_SANDBOX_NAME);
      inputBoxSpy.onCall(1).returns(SANDBOX_NAME);
      inputBoxSpy.onCall(2).returns('');
      inputBoxSpy.onCall(3).returns('');
      const gatherer = new SandboxCloneGatherer();
      const response = await gatherer.gather();
      expect(inputBoxSpy.callCount).to.equal(4);
      if (response.type === EVENT_CONTINUE) {
        expect(response.data.waitTime).to.equal(DEFAULT_WAIT_TIME_MINS);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });

    it('Should return Cancel since the user canceled (pressed ESC)', async () => {
      inputBoxSpy.onCall(0).returns(TEST_ALIAS);
      inputBoxSpy.onCall(1).returns(undefined);
      const gatherer = new SandboxCloneGatherer();
      const response = await gatherer.gather();
      expect(inputBoxSpy.callCount).to.equal(2);
      expect(response.type).to.equal(EVENT_CANCEL);
    });
  });

  describe('Sandbox Create Builder', () => {
    it('Should build the sandbox create command', async () => {
      const CONFIG_FILE = 'configFile.txt';
      const TEST_ALIAS = 'testAlias';
      const WAIT_TIME_IN_MINS = '2';
      const SOURCE_SANDBOX_NAME = 'sourceSandbox';
      const SANDBOX_NAME = 'destinationSandbox';
      const forceSandboxCreateBuilder = new ForceSandboxCloneExecutor();
      const createCommand = forceSandboxCreateBuilder.build({
        file: path.join(getRootWorkspacePath(), CONFIG_FILE),
        alias: TEST_ALIAS,
        waitTime: WAIT_TIME_IN_MINS,
        sourceSandbox: SOURCE_SANDBOX_NAME,
        sandboxName: SANDBOX_NAME
      });
      expect(createCommand.toCommand()).to.equal(
        `sfdx force:org:clone --type sandbox -a ${TEST_ALIAS} -w ${WAIT_TIME_IN_MINS} SourceSandboxName=${SOURCE_SANDBOX_NAME} sandboxName=${SANDBOX_NAME} --json --loglevel fatal`
      );
      expect(createCommand.description).to.equal(
        nls.localize('force_sandbox_clone')
      );
    });
  });
});
