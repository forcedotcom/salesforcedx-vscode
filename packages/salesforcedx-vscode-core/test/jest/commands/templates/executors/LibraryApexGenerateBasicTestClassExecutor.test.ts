/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TemplateType } from '@salesforce/templates';
import {
  CREATE_UNIT_NAME_KEY,
  LibraryApexGenerateBasicTestClassExecutor,
  TELEMETRY_NAME
} from '../../../../../src/commands/templates/executors/LibraryApexGenerateBasicTestClassExecutor';
import { APEX_CLASS_TYPE } from '../../../../../src/commands/templates/metadataTypeConstants';
import { nls } from '../../../../../src/messages';

describe('LibraryApexGenerateBasicTestClassExecutor Unit Tests.', () => {
  let executor: LibraryApexGenerateBasicTestClassExecutor;

  beforeEach(() => {
    executor = new LibraryApexGenerateBasicTestClassExecutor();
    jest.spyOn(nls, 'localize').mockReturnValue(CREATE_UNIT_NAME_KEY);
  });
  it('Should have correct defaults properties.', () => {
    expect(executor.telemetryName).toEqual(TELEMETRY_NAME);
    expect(executor.metadataTypeName).toEqual(APEX_CLASS_TYPE);
    expect(executor.templateType).toEqual(TemplateType.ApexClass);
  });

  it('Should return fileName of supplied data.', () => {
    const data = { fileName: 'testFileName', outputdir: 'testOutputDir' };
    expect(executor.getOutputFileName(data)).toEqual(data.fileName);
  });

  it('Should return templateOptions of supplied data.', () => {
    const data = { fileName: 'testFileName', outputdir: 'testOutputDir' };
    const templateOptions = executor.constructTemplateOptions(data);
    expect(templateOptions).toEqual({
      template: 'BasicUnitTest',
      classname: data.fileName,
      outputdir: data.outputdir
    });
  });
});
