/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  SObjectCategory,
  SObjectRefreshSource,
  SObjectTransformer,
  SObjectTransformerFactory
} from '@salesforce/salesforcedx-sobjects-faux-generator';
import { LocalCommandExecution } from '@salesforce/salesforcedx-utils-vscode';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import { channelService } from '../../../src/channels';
import { RefreshSObjectsExecutor } from '../../../src/commands';

describe('RefreshSObjectsExecutor', () => {
  let channelServiceSpy: jest.SpyInstance;
  let transformer: SObjectTransformer;

  beforeEach(() => {
    transformer = new SObjectTransformer(new EventEmitter(), [], []);
    channelServiceSpy = jest.spyOn(channelService, 'showChannelOutput').mockImplementation(jest.fn());

    jest.spyOn(channelService, 'clear').mockImplementation(jest.fn());
    jest.spyOn(channelService, 'streamCommandOutput').mockImplementation(jest.fn());
    jest.spyOn(SObjectTransformerFactory, 'create').mockResolvedValue(transformer);
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
  });

  it('should open the Output Channel', async () => {
    await doExecute(SObjectRefreshSource.Startup, SObjectCategory.STANDARD);
    expect(channelServiceSpy).toHaveBeenCalled();
  });

  it('should not open the Output Channel if in a container environment', async () => {
    process.env.SF_CONTAINER_MODE = 'true';
    await doExecute(SObjectRefreshSource.Startup, SObjectCategory.STANDARD);
    expect(channelServiceSpy).not.toHaveBeenCalled();
  });

  it('should fire the command completion event once the command is finished successfully', async () => {
    const fireSpy = jest.spyOn(RefreshSObjectsExecutor.refreshSObjectsCommandCompletionEventEmitter, 'fire');

    await doExecute(SObjectRefreshSource.Startup, SObjectCategory.STANDARD);

    expect(fireSpy).toHaveBeenCalledWith({
      exitCode: LocalCommandExecution.SUCCESS_CODE
    });
  });

  const doExecute = async (source: SObjectRefreshSource, category?: SObjectCategory) => {
    const executor = new RefreshSObjectsExecutor();
    await executor.execute({
      type: 'CONTINUE',
      data: { category: category || SObjectCategory.ALL, source }
    });
  };
});
