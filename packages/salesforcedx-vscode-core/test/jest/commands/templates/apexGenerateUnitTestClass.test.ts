/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { apexGenerateUnitTestClass } from '../../../../src/commands/templates';
import { clearGathererCache } from '../../../../src/commands/templates/apexGenerateClass';
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

jest.mock('../../../../src/commands/templates/executors/LibraryApexGenerateUnitTestClassExecutor');
jest.mock('../../../../src/commands/util/overwriteComponentPrompt');
jest.mock('../../../../src/commands/util/parameterGatherers');
jest.mock('../../../../src/commands/util/sfWorkspaceChecker');
jest.mock('../../../../src/commands/util/timestampConflictChecker');

const selectFileNameMocked = jest.mocked(SelectFileName);
const metadataTypeGathererMocked = jest.mocked(MetadataTypeGatherer);
const selectOutputDirMocked = jest.mocked(SelectOutputDir);
const libraryApexGenerateUnitTestClassExecutorMocked = jest.mocked(LibraryApexGenerateUnitTestClassExecutor);
const sfWorkspaceCheckerMocked = jest.mocked(SfWorkspaceChecker);
const compositeParametersGathererMocked = jest.mocked(CompositeParametersGatherer);
const overwriteComponentPromptMocked = jest.mocked(OverwriteComponentPrompt);
const simpleGathererMocked = jest.mocked(SimpleGatherer);

describe('apexGenerateUnitTestClass Unit Tests.', () => {
  let runMock: jest.Mock<any, any>;
  let sfCommandletMocked: jest.SpyInstance<any, any>;

  beforeEach(() => {
    clearGathererCache();
    runMock = jest.fn();
    // Note that the entire sfCommandlet module can not be mocked like the other modules b/c
    // there are multiple exports there that cause issues if not available.
    sfCommandletMocked = jest.spyOn(commandlet, 'SfCommandlet').mockImplementation((): any => {
      return {
        run: runMock
      };
    });
  });

  it('Should be able to execute apexGenerateUnitTestClass.', async () => {
    await apexGenerateUnitTestClass();
    expect(selectFileNameMocked).toHaveBeenCalledWith(APEX_CLASS_NAME_MAX_LENGTH);
    expect(selectOutputDirMocked).toHaveBeenCalledWith(APEX_CLASS_DIRECTORY);
    expect(metadataTypeGathererMocked).toHaveBeenCalledWith(APEX_CLASS_TYPE);
    expect(libraryApexGenerateUnitTestClassExecutorMocked).toHaveBeenCalled();
    expect(sfCommandletMocked).toHaveBeenCalled();
    expect(sfWorkspaceCheckerMocked).toHaveBeenCalled();
    expect(compositeParametersGathererMocked).toHaveBeenCalled();
    expect(overwriteComponentPromptMocked).toHaveBeenCalled();
    expect(runMock).toHaveBeenCalled();
  });

  it('Should not prompt if called with a file URI', async () => {
    // This happens when the command is executed from the context menu in the explorer on the classes folder.
    const selectedPathUri = {
      fsPath: '/path1/path2/project/force-app/main/default/classes'
    } as unknown as vscode.Uri;
    const selectedPathUris = [selectedPathUri];
    await apexGenerateUnitTestClass(selectedPathUri, selectedPathUris);
    expect(simpleGathererMocked).toHaveBeenCalledTimes(1);
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
    await apexGenerateUnitTestClass(outputDir, fileName);
    // still called even if not used because we are really measuring if they were initialized
    expect(selectFileNameMocked).toHaveBeenCalled();
    expect(selectOutputDirMocked).toHaveBeenCalled();
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
    await apexGenerateUnitTestClass(outputDir, fileName, 'BasicUnitTest');
    // still called even if not used because we are really measuring if they were initialized
    expect(selectFileNameMocked).toHaveBeenCalled();
    expect(selectOutputDirMocked).toHaveBeenCalled();
    expect(metadataTypeGathererMocked).toHaveBeenCalledWith(APEX_CLASS_TYPE);
    expect(libraryApexGenerateUnitTestClassExecutorMocked).toHaveBeenCalled();
    expect(sfCommandletMocked).toHaveBeenCalled();
    expect(sfWorkspaceCheckerMocked).toHaveBeenCalled();
    expect(compositeParametersGathererMocked).toHaveBeenCalled();
    expect(overwriteComponentPromptMocked).toHaveBeenCalled();
    expect(runMock).toHaveBeenCalled();
    expect(simpleGathererMocked).toHaveBeenCalled();
    expect(simpleGathererMocked).toHaveBeenCalledTimes(3);
    expect(simpleGathererMocked.mock.calls[2]).toEqual([{ template: 'BasicUnitTest' }]);
  });
});
