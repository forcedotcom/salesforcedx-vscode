/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as utilsVscode from '@salesforce/salesforcedx-utils-vscode';
import { URI } from 'vscode-uri';
import { internalLightningGenerateLwc } from '../../../../src/commands/templates';
import { SelectFileName } from '../../../../src/commands/util/parameterGatherers';

jest.mock('../../../../src/commands/util/parameterGatherers');
jest.mock('@salesforce/salesforcedx-utils-vscode', () => {
  const actual = jest.requireActual('@salesforce/salesforcedx-utils-vscode');
  return {
    ...actual,
    CompositeParametersGatherer: jest.fn()
  };
});

const selectFileNameMocked = jest.mocked(SelectFileName);

describe('internalLightningGenerateLwc Unit Tests.', () => {
  let runMock: jest.Mock<any, any>;
  let sfCommandletMocked: jest.SpyInstance<any, any>;

  beforeEach(() => {
    runMock = jest.fn();
    sfCommandletMocked = jest.spyOn(utilsVscode, 'SfCommandlet').mockImplementation((): any => ({
      run: runMock
    }));
  });

  it('Should generate lwc scaffolding.', () => {
    internalLightningGenerateLwc(URI.file('/some/lwc/dir') as any);
    expect(sfCommandletMocked).toHaveBeenCalled();
    expect(selectFileNameMocked).toHaveBeenCalled();
    expect(runMock).toHaveBeenCalled();
  });
});
