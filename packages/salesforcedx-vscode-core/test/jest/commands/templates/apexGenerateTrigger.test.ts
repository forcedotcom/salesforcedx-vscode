/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { apexGenerateTrigger } from '../../../../src/commands/templates';
import { LibraryApexGenerateTriggerExecutor } from '../../../../src/commands/templates/executors/LibraryApexGenerateTriggerExecutor';
import {
  APEX_TRIGGER_DIRECTORY,
  APEX_TRIGGER_NAME_MAX_LENGTH,
  APEX_TRIGGER_TYPE
} from '../../../../src/commands/templates/metadataTypeConstants';
import { OverwriteComponentPrompt } from '../../../../src/commands/util/overwriteComponentPrompt';
import {
  CompositeParametersGatherer,
  MetadataTypeGatherer,
  SelectFileName,
  SelectOutputDir
} from '../../../../src/commands/util/parameterGatherers';
import * as commandlet from '../../../../src/commands/util/sfCommandlet';
import { SfWorkspaceChecker } from '../../../../src/commands/util/sfWorkspaceChecker';

jest.mock('../../../../src/commands/templates/executors/LibraryApexGenerateTriggerExecutor');
jest.mock('../../../../src/commands/util/overwriteComponentPrompt');
jest.mock('../../../../src/commands/util/parameterGatherers');
jest.mock('../../../../src/commands/util/sfWorkspaceChecker');

const selectFileNameMocked = jest.mocked(SelectFileName);
const metadataTypeGathererMocked = jest.mocked(MetadataTypeGatherer);
const selectOutputDirMocked = jest.mocked(SelectOutputDir);
const libraryApexGenerateTriggerExecutorMocked = jest.mocked(LibraryApexGenerateTriggerExecutor);
const sfWorkspaceCheckerMocked = jest.mocked(SfWorkspaceChecker);
const compositeParametersGathererMocked = jest.mocked(CompositeParametersGatherer);
const overwriteComponentPromptMocked = jest.mocked(OverwriteComponentPrompt);

describe('apexGenerateTrigger Unit Tests.', () => {
  let runMock: jest.Mock<any, any>;
  let sfCommandletMocked: jest.SpyInstance<any, any>;

  beforeEach(() => {
    runMock = jest.fn();
    // Note that the entire sfCommandlet module can not be mocked like the other modules b/c
    // there are multiple exports there that cause issues if not available.
    sfCommandletMocked = jest.spyOn(commandlet, 'SfCommandlet').mockImplementation((): any => {
      return {
        run: runMock
      };
    });
  });

  it('Should be able to execute apexGenerateTrigger.', async () => {
    await apexGenerateTrigger();
    expect(selectFileNameMocked).toHaveBeenCalledWith(APEX_TRIGGER_NAME_MAX_LENGTH);
    expect(selectOutputDirMocked).toHaveBeenCalledWith(APEX_TRIGGER_DIRECTORY);
    expect(metadataTypeGathererMocked).toHaveBeenCalledWith(APEX_TRIGGER_TYPE);
    expect(libraryApexGenerateTriggerExecutorMocked).toHaveBeenCalled();
    expect(sfCommandletMocked).toHaveBeenCalled();
    expect(sfWorkspaceCheckerMocked).toHaveBeenCalled();
    expect(compositeParametersGathererMocked).toHaveBeenCalled();
    expect(overwriteComponentPromptMocked).toHaveBeenCalled();
    expect(runMock).toHaveBeenCalled();
  });
});
