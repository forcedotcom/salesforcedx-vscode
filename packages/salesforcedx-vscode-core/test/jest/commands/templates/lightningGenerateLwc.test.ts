/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { lightningGenerateLwc } from '../../../../src/commands/templates';
import { OverwriteComponentPrompt } from '../../../../src/commands/util/overwriteComponentPrompt';
import {
  CompositeParametersGatherer,
  MetadataTypeGatherer,
  SelectFileName,
  SelectOutputDir,
  SelectLwcComponentType
} from '../../../../src/commands/util/parameterGatherers';
import * as commandlet from '../../../../src/commands/util/sfCommandlet';
import { SfWorkspaceChecker } from '../../../../src/commands/util/sfWorkspaceChecker';

jest.mock('../../../../src/commands/util/sfCommandlet');
jest.mock('../../../../src/commands/util/sfWorkspaceChecker');
jest.mock('../../../../src/commands/util/overwriteComponentPrompt');
jest.mock('../../../../src/commands/util/parameterGatherers');

const selectFileNameMocked = jest.mocked(SelectFileName);
const metadataTypeGathererMocked = jest.mocked(MetadataTypeGatherer);
const selectOutputDirMocked = jest.mocked(SelectOutputDir);
const compositeParametersGathererMocked = jest.mocked(CompositeParametersGatherer);
const overwriteComponentPromptMocked = jest.mocked(OverwriteComponentPrompt);
const sfWorkspaceCheckerMocked = jest.mocked(SfWorkspaceChecker);
const selectLwcComponentTypeMocked = jest.mocked(SelectLwcComponentType);

describe('lightningGenerateLwc Unit Tests.', () => {
  let runMock: jest.Mock<any, any>;
  let sfCommandletMocked: jest.SpyInstance<any, any>;

  beforeEach(() => {
    runMock = jest.fn();
    sfCommandletMocked = jest.spyOn(commandlet, 'SfCommandlet').mockImplementation((): any => {
      return {
        run: runMock
      };
    });
  });

  it('Should generate lwc scaffolding.', async () => {
    await lightningGenerateLwc();
    expect(sfCommandletMocked).toHaveBeenCalled();
    expect(sfWorkspaceCheckerMocked).toHaveBeenCalled();
    expect(metadataTypeGathererMocked).toHaveBeenCalled();
    expect(selectLwcComponentTypeMocked).toHaveBeenCalled();
    expect(selectFileNameMocked).toHaveBeenCalled();
    expect(compositeParametersGathererMocked).toHaveBeenCalled();
    expect(selectOutputDirMocked).toHaveBeenCalled();
    expect(overwriteComponentPromptMocked).toHaveBeenCalled();
    expect(runMock).toHaveBeenCalled();
  });
});
