/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { EOL } from 'os';
import * as proxyquire from 'proxyquire';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import {
  CliCommandExecutor,
  CommandBuilder,
  SfdxCommandBuilder
} from '../../../src/cli';
import { nls } from '../../../src/messages';

class MockChannel {
  public readonly name = 'MockChannel';
  public value = '';

  public append(value: string): void {
    this.value += value;
  }

  public appendLine(value: string): void {
    this.value += value;
    this.value += EOL;
  }

  public clear(): void {}
  public show(preserveFocus?: boolean | undefined): void;
  public show(column?: any, preserveFocus?: any) {}
  public hide(): void {}
  public dispose(): void {}
}

const vscodeStub = {
  window: {
    // @ts-ignore
    createOutputChannel: mockChannel => {
      return mockChannel;
    }
  }
};

const { ChannelService } = proxyquire.noCallThru()('../../../src/commands', {
  vscode: vscodeStub
});

describe('Channel Service', () => {
  let mChannel: MockChannel;
  // @ts-ignore
  let channelService;
  let sb: SinonSandbox;

  beforeEach(() => {
    mChannel = new MockChannel();
    channelService = new ChannelService(mChannel);
    sb = createSandbox();
  });

  afterEach(async () => {
    sb.restore();
  });

  it('Should pipe stdout on successful command execution', async () => {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force')
        .withArg('--help')
        .build(),
      {}
    ).execute();
    // @ts-ignore
    channelService.streamCommandOutput(execution);

    await new Promise<string>((resolve, reject) => {
      execution.processExitSubject.subscribe(data => {
        resolve();
      });
    });
    expect(mChannel.value).to.contain('Starting sfdx force --help');
    expect(mChannel.value).to.contain(
      'USAGE\n  $ sfdx force [--json] [--loglevel \n  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]'
    );
    expect(mChannel.value).to.contain('ended with exit code 0');
  });

  it('Should pipe stderr on unsuccessful command execution', async () => {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force')
        .withArg('--unknown')
        .build(),
      {}
    ).execute();
    // @ts-ignore
    channelService.streamCommandOutput(execution);

    await new Promise<string>((resolve, reject) => {
      execution.processExitSubject.subscribe(data => {
        resolve();
      });
    });
    expect(mChannel.value).to.contain('Unexpected argument: --unknown');
  });

  it('Should suggest to install SFDX binary', async () => {
    const execution = new CliCommandExecutor(
      new CommandBuilder('sfdx_')
        .withArg('force')
        .withArg('--unknown')
        .build(),
      {}
    ).execute();
    // @ts-ignore
    channelService.streamCommandOutput(execution);

    await new Promise<string>((resolve, reject) => {
      execution.processErrorSubject.subscribe(data => {
        resolve();
      });
    });
    expect(mChannel.value).to.contain(
      nls.localize('channel_end_with_sfdx_not_found')
    );
  });

  it('should test ensureDoubleDigits functions', async () => {
    const ensureDoubleDigitsStub: SinonStub = sb.stub(
      ChannelService.prototype,
      'ensureDoubleDigits' as any
    );
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force')
        .withArg('--help')
        .build(),
      {}
    ).execute();
    // @ts-ignore
    channelService.streamCommandOutput(execution);
    expect(ensureDoubleDigitsStub.called).equals(true);
  });
});
