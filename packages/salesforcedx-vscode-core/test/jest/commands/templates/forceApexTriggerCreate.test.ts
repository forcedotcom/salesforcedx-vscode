/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { forceApexTriggerCreate } from '../../../../src/commands/templates';
import { LibraryForceApexTriggerCreateExecutor } from '../../../../src/commands/templates/executors/libraryForceApexTriggerCreateExecutor';
import {
  APEX_TRIGGER_DIRECTORY,
  APEX_TRIGGER_NAME_MAX_LENGTH,
  APEX_TRIGGER_TYPE
} from '../../../../src/commands/templates/metadataTypeConstants';
import {
  CompositeParametersGatherer,
  MetadataTypeGatherer,
  SelectFileName,
  SelectOutputDir
} from '../../../../src/commands/util/parameterGatherers';
import { OverwriteComponentPrompt } from '../../../../src/commands/util/overwriteComponentPrompt';
import { SfdxWorkspaceChecker } from '../../../../src/commands/util/preconditionCheckers';
import * as commandlet from '../../../../src/commands/util/sfdxCommandlet';

jest.mock('../../../../src/commands/util/parameterGatherers');
jest.mock(
  '../../../../src/commands/templates/executors/libraryForceApexTriggerCreateExecutor'
);
jest.mock('../../../../src/commands/util/preconditionCheckers');
jest.mock('../../../../src/commands/util/postconditionCheckers');

const selectFileNameMocked = jest.mocked(SelectFileName);
const metadataTypeGathererMocked = jest.mocked(MetadataTypeGatherer);
const selectOutputDirMocked = jest.mocked(SelectOutputDir);
const libraryForceApexTriggerCreateExecutorMocked = jest.mocked(
  LibraryForceApexTriggerCreateExecutor
);
const sfdxWorkspaceCheckerMocked = jest.mocked(SfdxWorkspaceChecker);
const compositeParametersGathererMocked = jest.mocked(
  CompositeParametersGatherer
);
const overwriteComponentPromptMocked = jest.mocked(OverwriteComponentPrompt);

describe('forceApexTriggerCreate Unit Tests.', () => {
  let runMock: jest.Mock<any, any>;
  let sfdxCommandletMocked: jest.SpyInstance<any, any>;

  beforeEach(() => {
    runMock = jest.fn();
    // Note that the entire sfdxCommandlet module can not be mocked like the other modules b/c
    // there are multiple exports there that cause issues if not available.
    sfdxCommandletMocked = jest
      .spyOn(commandlet, 'SfdxCommandlet')
      .mockImplementation((): any => {
        return {
          run: runMock
        };
      });
  });
  it('Should be able to execute forceApexTriggerCreate.', async () => {
    await forceApexTriggerCreate();
    expect(selectFileNameMocked).toHaveBeenCalledWith(
      APEX_TRIGGER_NAME_MAX_LENGTH
    );
    expect(selectOutputDirMocked).toHaveBeenCalledWith(APEX_TRIGGER_DIRECTORY);
    expect(metadataTypeGathererMocked).toHaveBeenCalledWith(APEX_TRIGGER_TYPE);
    expect(libraryForceApexTriggerCreateExecutorMocked).toHaveBeenCalled();
    expect(sfdxCommandletMocked).toHaveBeenCalled();
    expect(sfdxWorkspaceCheckerMocked).toHaveBeenCalled();
    expect(compositeParametersGathererMocked).toHaveBeenCalled();
    expect(overwriteComponentPromptMocked).toHaveBeenCalled();
    expect(runMock).toHaveBeenCalled();
  });
});
