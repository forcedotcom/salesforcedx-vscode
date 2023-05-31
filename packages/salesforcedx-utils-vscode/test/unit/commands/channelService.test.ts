/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { OutputChannel } from 'vscode';
import * as vscode from 'vscode';
import { ChannelService } from '../../../src';
import {
  CliCommandExecutor,
  CommandBuilder,
  SfdxCommandBuilder
} from '../../../src/cli';
import { nls } from '../../../src/messages';
import { MockChannel, vscodeStub } from './mocks';

describe('Channel Service', () => {
  let mChannel: MockChannel;
  let mChannel2: MockChannel;
  let channelService: ChannelService;
  let sb: SinonSandbox;

  beforeEach(() => {
    mChannel = new MockChannel();
    mChannel2 = new MockChannel();
    channelService = new ChannelService(mChannel as OutputChannel);
    sb = createSandbox();
  });

  afterEach(async () => {
    sb.restore();
  });

  it('Should create new singleton instance of channel if it does not exist', () => {
    sb.stub(vscodeStub.window, 'createOutputChannel')
      .withArgs('first')
      .returns(mChannel)
      .withArgs('second')
      .returns(mChannel2);

    const chan1 = ChannelService.getInstance('first');
    const chan2 = ChannelService.getInstance('second');

    expect(chan1).not.equals(chan2);
  });

  it('Should return existing singleton instance of channel if it exists', () => {
    sb.stub(vscodeStub.window, 'createOutputChannel')
      .withArgs('first')
      .returns(mChannel)
      .withArgs('second')
      .returns(mChannel2);

    const chan1 = ChannelService.getInstance('first');
    const chan2 = ChannelService.getInstance('first');

    expect(chan1).equals(chan2);
  });

  // Fails locally and on GHA
  // https://github.com/forcedotcom/easywriter/issues/96
  it.skip('Should pipe stdout on successful command execution', async () => {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force')
        .withArg('--help')
        .build(),
      {}
    ).execute();
    channelService.streamCommandOutput(execution);

    await new Promise<string | void>(resolve => {
      execution.processExitSubject.subscribe(() => {
        resolve();
      });
    });
    expect(mChannel.value).to.contain('Starting sfdx force --help');
    expect(mChannel.value).to.contain(
      'USAGE\n  $ sfdx force [--json] [--loglevel'
    );
    expect(mChannel.value).to.contain('ended with exit code 0');
  });

  // Fails locally and on GHA
  // https://github.com/forcedotcom/easywriter/issues/96
  it.skip('Should pipe stderr on unsuccessful command execution', async () => {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force')
        .withArg('--unknown')
        .build(),
      {}
    ).execute();
    // @ts-ignore
    channelService.streamCommandOutput(execution);

    await new Promise<string | void>((resolve, reject) => {
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

    await new Promise<string | void>((resolve, reject) => {
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

  it('should clear channel', async () => {
    const clearStub = sb.stub(mChannel, 'clear');
    sb.stub(vscodeStub.window, 'createOutputChannel').returns(mChannel);
    // @ts-ignore
    channelService.clear();
    expect(clearStub.called).equals(true);
  });

  it('should clear channel when streamCommandStartStop is executed', () => {
    const clearStub = sb.stub(mChannel, 'clear');
    sb.stub(vscodeStub.window, 'createOutputChannel').returns(mChannel);
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force')
        .withArg('--help')
        .build(),
      {}
    ).execute();
    // @ts-ignore
    channelService.streamCommandStartStop(execution);
    expect(clearStub.called).equals(true);
  });
});
