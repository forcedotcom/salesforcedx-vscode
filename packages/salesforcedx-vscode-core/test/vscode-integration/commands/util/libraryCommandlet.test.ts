/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { channelService } from '../../../../src/channels';
import { LibraryCommandletExecutor } from '../../../../src/commands/util';
import { notificationService } from '../../../../src/notifications';
import { telemetryService } from '../../../../src/telemetry';

const env = createSandbox();

class TestExecutor extends LibraryCommandletExecutor<{ success: boolean }> {
  protected logName = 'test_command';
  protected executionName = 'Test Command';

  constructor(private error?: Error) {
    super();
  }

  protected async run(response: ContinueResponse<{ success: boolean }>) {
    if (this.error) {
      throw this.error;
    }
    return { success: response.data.success };
  }
}

describe('LibraryCommandletExecutor', () => {
  const executor = new TestExecutor();

  afterEach(() => env.restore());

  it('should reveal channel output if revealChannelOutput = true', async () => {
    const showOutputStub = env.spy(channelService, 'showChannelOutput');
    // @ts-ignore allow public setter for testing
    executor.revealChannelOutput = true;

    await executor.execute({ data: { success: true }, type: 'CONTINUE' });

    expect(showOutputStub.called).to.equal(true);
  });

  it('should show successful execution notification if run returns true', async () => {
    const showSuccessStub = env.spy(notificationService, 'showSuccessfulExecution');

    await executor.execute({ data: { success: true }, type: 'CONTINUE' });

    expect(showSuccessStub.called).to.equal(true);
  });

  it('should show failed execution notification if run returns false', async () => {
    const showFailedStub = env.spy(notificationService, 'showFailedExecution');

    await executor.execute({ data: { success: false }, type: 'CONTINUE' });

    expect(showFailedStub.called).to.equal(true);
  });

  it('should log command event if there were no issues running', async () => {
    const sendCommandEventStub = env.stub(telemetryService, 'sendCommandEvent');

    await executor.execute({ data: { success: false }, type: 'CONTINUE' });

    expect(sendCommandEventStub.called).to.equal(true);
    const { args } = sendCommandEventStub.getCall(0);
    expect(args[0]).to.equal(
      // @ts-ignore allow public getter for testing
      executor.logName
    );
    expect(typeof (args[1][0]) === 'number' && typeof (args[1][1]) === 'number').to.equal(true);
    expect(args[2]).to.deep.equal({ success: 'false' });
    expect(args[3]).to.equal(undefined);
  });

  describe('Handling Unexpected Errors', () => {
    const error = new Error('whoops');
    const errorExecutor = new TestExecutor(error);

    it('should log exception', async () => {
      const sendExceptionStub = env.stub(telemetryService, 'sendException');

      await errorExecutor.execute({ data: { success: true }, type: 'CONTINUE' });

      expect(sendExceptionStub.called).to.equal(true);
      expect(sendExceptionStub.getCall(0).args).to.deep.equal([
        error.name,
        error.message
      ]);
    });

    it('should show failed execution notification', async () => {
      const showFailedStub = env.stub(notificationService, 'showFailedExecution');

      await errorExecutor.execute({ data: { success: true }, type: 'CONTINUE' });

      expect(showFailedStub.called).to.equal(true);
      expect(showFailedStub.getCall(0).args).to.deep.equal([
        // @ts-ignore allow public getting for testing
        errorExecutor.executionName
      ]);
    });

    it('should open the channel output', async () => {
      const appendLineStub = env.stub(channelService, 'appendLine');
      const showOutputStub = env.stub(channelService, 'showChannelOutput');

      await errorExecutor.execute({ data: { success: true }, type: 'CONTINUE' });

      expect(appendLineStub.called).to.equal(true);
      expect(appendLineStub.getCall(0).args).to.deep.equal([error.message]);
      expect(showOutputStub.calledImmediatelyAfter(appendLineStub)).to.equal(true);
    });
  });
});
