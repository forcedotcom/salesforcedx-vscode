/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ContinueResponse,
  LibraryCommandletExecutor,
  SourceTrackingService
} from '@salesforce/salesforcedx-utils-vscode';
import { channelService, OUTPUT_CHANNEL } from '../../channels';
import { nls } from '../../messages';

export class SourceTrackingGetStatusExecutor extends LibraryCommandletExecutor<string> {
  private options;

  constructor(executionName: string, logName: string, options?: { local: boolean; remote: boolean }) {
    super(nls.localize(executionName), logName, OUTPUT_CHANNEL);
    this.options = options;
  }

  public async execute(): Promise<void> {
    const sourceStatusSummary: string = await SourceTrackingService.getSourceStatusSummary(this.options || {});
    channelService.appendLine(nls.localize('source_status'));
    channelService.appendLine(sourceStatusSummary);
    channelService.showChannelOutput();
  }

  public async run(response: ContinueResponse<string>): Promise<boolean> {
    await this.execute();
    return true;
  }
}
