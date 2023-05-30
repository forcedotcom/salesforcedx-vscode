/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as sfdx from '../../src/sfdx';

describe('sfdx utils', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('withSFConnection', () => {
    function run(showErrorMessage: boolean) {
      it(`should ${
        showErrorMessage ? '' : 'not '
      }display an error, channel log, and send telemetry if can not get connection to org when showErrorMessage=${showErrorMessage}`, async () => {
        sandbox.stub(sfdx.workspaceContext, 'getConnection').throws();
        const vscodeErrorMessageSpy = sandbox.spy(
          vscode.window,
          'showErrorMessage'
        );
        const channelServiceSpy = sandbox.spy(
          sfdx.channelService,
          'appendLine'
        );
        await sfdx.withSFConnection(async () => {}, showErrorMessage);
        sfdx.debouncedShowChannelAndErrorMessage.flush();
        const errorCount = showErrorMessage ? 1 : 0;
        expect(vscodeErrorMessageSpy.callCount).to.equal(errorCount);
        expect(channelServiceSpy.callCount).to.equal(errorCount);
      });
    }

    run(true);
    run(false);
  });
});
