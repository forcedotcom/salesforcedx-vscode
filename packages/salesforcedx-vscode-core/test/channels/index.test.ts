import {
  CliCommandExecutor,
  CommandBuilder,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import { EOL } from 'os';
import { OutputChannel, ViewColumn } from 'vscode';
import {
  ChannelService,
  DEFAULT_SFDX_CHANNEL
} from '../../src/channels/channelService';
import { localize } from '../../src/messages';

class MockChannel implements OutputChannel {
  public readonly name = 'MockChannel';
  public value = '';

  public append(value: string): void {
    this.value += value;
  }

  public appendLine(value: string): void {
    this.value += value;
    this.value += EOL;
  }

  // These methods are not mocked but needed as part of the interface
  // tslint:disable:no-empty
  public clear(): void {}
  public show(preserveFocus?: boolean | undefined): void;
  public show(
    column?: ViewColumn | undefined,
    preserveFocus?: boolean | undefined
  ): void;
  public show(column?: any, preserveFocus?: any) {}
  public hide(): void {}
  public dispose(): void {}
  // tslint:enable:no-empty
}

describe('Channel', () => {
  describe('Default SFDX channel', () => {
    let mChannel: MockChannel;
    let channelService: ChannelService;

    beforeEach(() => {
      mChannel = new MockChannel();
      channelService = new ChannelService(mChannel);
    });

    it('Should have proper name', () => {
      expect(DEFAULT_SFDX_CHANNEL.name).to.equal('SalesforceDX CLI');
    });

    it('Should pipe stdout on successful command execution', async () => {
      const execution = new CliCommandExecutor(
        new SfdxCommandBuilder().withArg('force').withArg('--help').build(),
        {}
      ).execute();

      channelService.streamCommandOutput(execution);

      await new Promise<string>((resolve, reject) => {
        execution.processExitSubject.subscribe(data => {
          resolve();
        });
      });
      expect(mChannel.value).to.contain(
        'Usage: sfdx COMMAND [command-specific-options]'
      );
      expect(mChannel.value).to.contain('ended with exit code 0');
    });

    it('Should pipe stderr on unsuccessful command execution', async () => {
      const execution = new CliCommandExecutor(
        new SfdxCommandBuilder().withArg('force').withArg('--unknown').build(),
        {}
      ).execute();

      channelService.streamCommandOutput(execution);

      await new Promise<string>((resolve, reject) => {
        execution.processExitSubject.subscribe(data => {
          resolve();
        });
      });
      expect(mChannel.value).to.contain('Error: Unexpected flag --unknown');
      expect(mChannel.value).to.contain('ended with exit code 2');
    });

    it('Should suggest to install SFDX binary', async () => {
      const execution = new CliCommandExecutor(
        new CommandBuilder('sfdx_')
          .withArg('force')
          .withArg('--unknown')
          .build(),
        {}
      ).execute();

      channelService.streamCommandOutput(execution);

      await new Promise<string>((resolve, reject) => {
        execution.processErrorSubject.subscribe(data => {
          resolve();
        });
      });
      expect(mChannel.value).to.contain(
        localize('channel_end_with_sfdx_not_found')
      );
    });
  });
});
