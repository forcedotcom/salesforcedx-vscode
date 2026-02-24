/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fauxGen from '@salesforce/salesforcedx-sobjects-faux-generator';
import { LocalCommandExecution } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { channelService } from '../../../src/channels';
import { RefreshSObjectsExecutor } from '../../../src/commands/refreshSObjects';
import * as artifactWriter from '../../../src/commands/sobjectArtifactWriter';

const mockServicesExtension = {
  isActive: true,
  exports: {
    services: {
      MetadataDescribeService: {
        Default: Layer.empty,
        listSObjects: () => Effect.succeed([]),
        describeCustomObjects: () => Stream.empty
      }
    }
  }
};

const mockArtifactResult = { data: { cancelled: false, standardObjects: 0, customObjects: 0 } };

describe('RefreshSObjectsExecutor', () => {
  let channelServiceSpy: jest.SpyInstance;

  beforeEach(() => {
    channelServiceSpy = jest.spyOn(channelService, 'showChannelOutput').mockImplementation(jest.fn());

    jest.spyOn(channelService, 'clear').mockImplementation(jest.fn());
    jest.spyOn(channelService, 'streamCommandOutput').mockImplementation(jest.fn());
    jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({ type: vscode.FileType.File } as vscode.FileStat);
    jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue(
      mockServicesExtension as unknown as vscode.Extension<unknown>
    );
    jest.spyOn(artifactWriter, 'writeSobjectArtifacts').mockResolvedValue(mockArtifactResult);
    jest.spyOn(artifactWriter, 'streamAndWriteSobjectArtifacts').mockResolvedValue(mockArtifactResult);
  });

  it('should open the Output Channel', async () => {
    await doExecute('startup', 'STANDARD');
    expect(channelServiceSpy).toHaveBeenCalled();
  });

  it('should not open the Output Channel if in a container environment', async () => {
    process.env.SF_CONTAINER_MODE = 'true';
    await doExecute('startup', 'STANDARD');
    expect(channelServiceSpy).not.toHaveBeenCalled();
  });

  it('should fire the command completion event once the command is finished successfully', async () => {
    const fireSpy = jest.spyOn(RefreshSObjectsExecutor.refreshSObjectsCommandCompletionEventEmitter, 'fire');

    await doExecute('startup', 'STANDARD');

    expect(fireSpy).toHaveBeenCalledWith({
      exitCode: LocalCommandExecution.SUCCESS_CODE
    });
  });

  const doExecute = async (source: fauxGen.SObjectRefreshSource, category?: fauxGen.SObjectCategory) => {
    const executor = new RefreshSObjectsExecutor();
    await executor.execute({
      type: 'CONTINUE',
      data: { category: category ?? 'ALL', source }
    });
  };
});
