/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { apexGenerateUnitTestClass } from '../../../../src/commands/templates';
import { getParamGatherers } from '../../../../src/commands/templates/apexGenerateClass';
import { LibraryApexGenerateUnitTestClassExecutor } from '../../../../src/commands/templates/executors/LibraryApexGenerateUnitTestClassExecutor';
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
  SelectOutputDir,
  SimpleGatherer
} from '../../../../src/commands/util/parameterGatherers';
import * as commandlet from '../../../../src/commands/util/sfCommandlet';
import { SfWorkspaceChecker } from '../../../../src/commands/util/sfWorkspaceChecker';

jest.mock(
  '../../../../src/commands/templates/executors/LibraryApexGenerateUnitTestClassExecutor'
);
jest.mock('../../../../src/commands/util/overwriteComponentPrompt');
jest.mock('../../../../src/commands/util/parameterGatherers');
jest.mock('../../../../src/commands/util/sfWorkspaceChecker');
jest.mock('../../../../src/commands/util/timestampConflictChecker');

const selectFileNameMocked = jest.mocked(SelectFileName);
const metadataTypeGathererMocked = jest.mocked(MetadataTypeGatherer);
const selectOutputDirMocked = jest.mocked(SelectOutputDir);
const libraryApexGenerateUnitTestClassExecutorMocked = jest.mocked(
  LibraryApexGenerateUnitTestClassExecutor
);
const sfWorkspaceCheckerMocked = jest.mocked(SfWorkspaceChecker);
const compositeParametersGathererMocked = jest.mocked(
  CompositeParametersGatherer
);
const overwriteComponentPromptMocked = jest.mocked(OverwriteComponentPrompt);
const simpleGathererMocked = jest.mocked(SimpleGatherer);

describe('apexGenerateUnitTestClass Unit Tests.', () => {
  let runMock: jest.Mock<any, any>;
  let sfCommandletMocked: jest.SpyInstance<any, any>;

  beforeEach(() => {
    runMock = jest.fn();
    // Note that the entire sfCommandlet module can not be mocked like the other modules b/c
    // there are multiple exports there that cause issues if not available.
    sfCommandletMocked = jest
      .spyOn(commandlet, 'SfCommandlet')
      .mockImplementation((): any => {
        return {
          run: runMock
        };
      });
  });

  it('Should be able to execute apexGenerateUnitTestClass.', async () => {
    await apexGenerateUnitTestClass();
    expect(selectFileNameMocked).toHaveBeenCalledWith(
      APEX_CLASS_NAME_MAX_LENGTH
    );
    expect(selectOutputDirMocked).toHaveBeenCalledWith(APEX_CLASS_DIRECTORY);
    expect(metadataTypeGathererMocked).toHaveBeenCalledWith(APEX_CLASS_TYPE);
    expect(libraryApexGenerateUnitTestClassExecutorMocked).toHaveBeenCalled();
    expect(sfCommandletMocked).toHaveBeenCalled();
    expect(sfWorkspaceCheckerMocked).toHaveBeenCalled();
    expect(compositeParametersGathererMocked).toHaveBeenCalled();
    expect(overwriteComponentPromptMocked).toHaveBeenCalled();
    expect(runMock).toHaveBeenCalled();
  });

  it('Should prompt if the provided params are not valid.', async () => {
    // This happens when the command is executed from the context menu in the explorer on the classes folder.
    const notAString = { path: 'thing' };
    const notAString2 = { path: 'thing2' };
    await (apexGenerateUnitTestClass as any)(notAString, notAString2);
    // Note there is a bad pattern in the exported getParamGatherers method that uses module state to cache the gatherers.
    // This being the case the selectFileNameMocked check is invalid here when all tests are run.
    expect(simpleGathererMocked).not.toHaveBeenCalled();
    expect(metadataTypeGathererMocked).toHaveBeenCalledWith(APEX_CLASS_TYPE);
    expect(libraryApexGenerateUnitTestClassExecutorMocked).toHaveBeenCalled();
    expect(sfCommandletMocked).toHaveBeenCalled();
    expect(sfWorkspaceCheckerMocked).toHaveBeenCalled();
    expect(compositeParametersGathererMocked).toHaveBeenCalled();
    expect(overwriteComponentPromptMocked).toHaveBeenCalled();
    expect(runMock).toHaveBeenCalled();
  });

  it('Should used the passed parameters if provided.', async () => {
    const fileName = 'testFileName';
    const outputDir = 'testOutputDir';
    await apexGenerateUnitTestClass(fileName, outputDir);
    expect(selectFileNameMocked).not.toHaveBeenCalled();
    expect(selectOutputDirMocked).not.toHaveBeenCalled();
    expect(metadataTypeGathererMocked).toHaveBeenCalledWith(APEX_CLASS_TYPE);
    expect(libraryApexGenerateUnitTestClassExecutorMocked).toHaveBeenCalled();
    expect(sfCommandletMocked).toHaveBeenCalled();
    expect(sfWorkspaceCheckerMocked).toHaveBeenCalled();
    expect(compositeParametersGathererMocked).toHaveBeenCalled();
    expect(overwriteComponentPromptMocked).toHaveBeenCalled();
    expect(runMock).toHaveBeenCalled();
    expect(simpleGathererMocked).toHaveBeenCalledTimes(2);
  });

  it('Should used the passed parameters if provided, and correct template', async () => {
    const fileName = 'testFileName';
    const outputDir = 'testOutputDir';
    await apexGenerateUnitTestClass(fileName, outputDir, 'BasicUnitTest');
    expect(selectFileNameMocked).not.toHaveBeenCalled();
    expect(selectOutputDirMocked).not.toHaveBeenCalled();
    expect(metadataTypeGathererMocked).toHaveBeenCalledWith(APEX_CLASS_TYPE);
    expect(libraryApexGenerateUnitTestClassExecutorMocked).toHaveBeenCalled();
    expect(sfCommandletMocked).toHaveBeenCalled();
    expect(sfWorkspaceCheckerMocked).toHaveBeenCalled();
    expect(compositeParametersGathererMocked).toHaveBeenCalled();
    expect(overwriteComponentPromptMocked).toHaveBeenCalled();
    expect(runMock).toHaveBeenCalled();
    expect(simpleGathererMocked).toHaveBeenCalled();
    expect(simpleGathererMocked).toHaveBeenCalledTimes(3);
    expect(simpleGathererMocked.mock.calls[2]).toEqual([
      { template: 'BasicUnitTest' }
    ]);
  });
});
