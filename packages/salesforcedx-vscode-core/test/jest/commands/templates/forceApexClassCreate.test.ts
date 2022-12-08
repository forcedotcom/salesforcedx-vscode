/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { forceApexClassCreate } from '../../../../src/commands/templates';
import { LibraryForceApexClassCreateExecutor } from '../../../../src/commands/templates/executors/LibraryForceApexClassCreateExecutor';
import {
  APEX_CLASS_DIRECTORY,
  APEX_CLASS_NAME_MAX_LENGTH,
  APEX_CLASS_TYPE
} from '../../../../src/commands/templates/metadataTypeConstants';
import {
  CompositeParametersGatherer,
  MetadataTypeGatherer,
  SelectFileName,
  SelectOutputDir
} from '../../../../src/commands/util/parameterGatherers';
import { OverwriteComponentPrompt } from '../../../../src/commands/util/postconditionCheckers';
import { SfdxWorkspaceChecker } from '../../../../src/commands/util/preconditionCheckers';
import * as commandlet from '../../../../src/commands/util/sfdxCommandlet';

jest.mock('../../../../src/commands/util/parameterGatherers');
jest.mock(
  '../../../../src/commands/templates/executors/LibraryForceApexClassCreateExecutor'
);
jest.mock('../../../../src/commands/util/preconditionCheckers');
jest.mock('../../../../src/commands/util/postconditionCheckers');

const selectFileNameMocked = jest.mocked(SelectFileName);
const metadataTypeGathererMocked = jest.mocked(MetadataTypeGatherer);
const selectOutputDirMocked = jest.mocked(SelectOutputDir);
const LibraryForceApexClassCreateExecutorMocked = jest.mocked(
  LibraryForceApexClassCreateExecutor
);
const sfdxWorkspaceCheckerMocked = jest.mocked(SfdxWorkspaceChecker);
const compositeParametersGathererMocked = jest.mocked(
  CompositeParametersGatherer
);
const overwriteComponentPromptMocked = jest.mocked(OverwriteComponentPrompt);

describe('forceApexClassCreate Unit Tests.', () => {
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
  it('Should be able to execute forceApexClassCreate.', async () => {
    await forceApexClassCreate();
    expect(selectFileNameMocked).toHaveBeenCalledWith(
      APEX_CLASS_NAME_MAX_LENGTH
    );
    expect(selectOutputDirMocked).toHaveBeenCalledWith(APEX_CLASS_DIRECTORY);
    expect(metadataTypeGathererMocked).toHaveBeenCalledWith(APEX_CLASS_TYPE);
    expect(LibraryForceApexClassCreateExecutorMocked).toHaveBeenCalled();
    expect(sfdxCommandletMocked).toHaveBeenCalled();
    expect(sfdxWorkspaceCheckerMocked).toHaveBeenCalled();
    expect(compositeParametersGathererMocked).toHaveBeenCalled();
    expect(overwriteComponentPromptMocked).toHaveBeenCalled();
    expect(runMock).toHaveBeenCalled();
  });
});
