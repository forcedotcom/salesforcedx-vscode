/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { forceApexUnitClassCreate } from '../../../../src/commands/templates';
import { LibraryForceApexUnitClassCreateExecutor } from '../../../../src/commands/templates/executors/LibraryForceApexUnitClassCreateExecutor';
import {
  APEX_CLASS_DIRECTORY,
  APEX_CLASS_NAME_MAX_LENGTH,
  APEX_CLASS_TYPE
} from '../../../../src/commands/templates/metadataTypeConstants';
import { OverwriteComponentPrompt } from '../../../../src/commands/util/overwriteComponentPrompt';
import {
  CompositeParametersGatherer,
  MetadataTypeGatherer,
  SelectFileName,
  SelectOutputDir
} from '../../../../src/commands/util/parameterGatherers';
import * as commandlet from '../../../../src/commands/util/sfdxCommandlet';
import { SfdxWorkspaceChecker } from '../../../../src/commands/util/sfdxWorkspaceChecker';

jest.mock('../../../../src/commands/templates/executors/LibraryForceApexUnitClassCreateExecutor');
jest.mock('../../../../src/commands/util/overwriteComponentPrompt');
jest.mock('../../../../src/commands/util/parameterGatherers');
jest.mock('../../../../src/commands/util/sfdxWorkspaceChecker');
jest.mock('../../../../src/commands/util/timestampConflictChecker');

const selectFileNameMocked = jest.mocked(SelectFileName);
const metadataTypeGathererMocked = jest.mocked(MetadataTypeGatherer);
const selectOutputDirMocked = jest.mocked(SelectOutputDir);
const libraryForceApexUnitClassCreateExecutorMocked = jest.mocked(
  LibraryForceApexUnitClassCreateExecutor
);
const sfdxWorkspaceCheckerMocked = jest.mocked(SfdxWorkspaceChecker);
const compositeParametersGathererMocked = jest.mocked(
  CompositeParametersGatherer
);
const overwriteComponentPromptMocked = jest.mocked(OverwriteComponentPrompt);

describe('forceApexUnitClassCreate Unit Tests.', () => {
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

  it('Should be able to execute forceApexUnitClassCreate.', async () => {
    await forceApexUnitClassCreate();
    expect(selectFileNameMocked).toHaveBeenCalledWith(
      APEX_CLASS_NAME_MAX_LENGTH
    );
    expect(selectOutputDirMocked).toHaveBeenCalledWith(APEX_CLASS_DIRECTORY);
    expect(metadataTypeGathererMocked).toHaveBeenCalledWith(APEX_CLASS_TYPE);
    expect(libraryForceApexUnitClassCreateExecutorMocked).toHaveBeenCalled();
    expect(sfdxCommandletMocked).toHaveBeenCalled();
    expect(sfdxWorkspaceCheckerMocked).toHaveBeenCalled();
    expect(compositeParametersGathererMocked).toHaveBeenCalled();
    expect(overwriteComponentPromptMocked).toHaveBeenCalled();
    expect(runMock).toHaveBeenCalled();
  });

  it('Should used the passed parameters if provided.', async () => {
    const fileName = 'testFileName';
    const outputDir = 'testOutputDir';
    await forceApexUnitClassCreate(fileName, outputDir);
    expect(selectFileNameMocked).not.toHaveBeenCalled();
    expect(selectOutputDirMocked).not.toHaveBeenCalled();
    expect(metadataTypeGathererMocked).toHaveBeenCalledWith(APEX_CLASS_TYPE);
    expect(libraryForceApexUnitClassCreateExecutorMocked).toHaveBeenCalled();
    expect(sfdxCommandletMocked).toHaveBeenCalled();
    expect(sfdxWorkspaceCheckerMocked).toHaveBeenCalled();
    expect(compositeParametersGathererMocked).toHaveBeenCalled();
    expect(overwriteComponentPromptMocked).toHaveBeenCalled();
    expect(runMock).toHaveBeenCalled();
  });
});
