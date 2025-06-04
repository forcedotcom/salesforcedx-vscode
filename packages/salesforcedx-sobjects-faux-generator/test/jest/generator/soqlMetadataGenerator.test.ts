/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as utils from '@salesforce/salesforcedx-utils-vscode';
import { join } from 'node:path';
import { CUSTOMOBJECTS_DIR, SOQLMETADATA_DIR, STANDARDOBJECTS_DIR } from '../../../src/constants';
import { generateAllMetadata } from '../../../src/generator/soqlMetadataGenerator';

const outputFolderPath = join(utils.projectPaths.toolsFolder(), SOQLMETADATA_DIR);

describe('SOQL metadata files generator', () => {
  const customMock = { name: 'Foo__c', label: 'Account', fields: [{ name: 'Id', label: 'Foo ID' }] };
  const standardMock = { name: 'Account', label: 'Account', fields: [{ name: 'Id', label: 'Account ID' }] };

  const customPath = join(outputFolderPath, CUSTOMOBJECTS_DIR);
  const standardPath = join(outputFolderPath, STANDARDOBJECTS_DIR);
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(utils, 'safeDelete').mockResolvedValue(undefined);
    jest.spyOn(utils, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(utils, 'createDirectory').mockResolvedValue(undefined);
  });

  it('Should delete and recreate standardObjects folder', async () => {
    await generateAllMetadata({
      // @ts-expect-error - partial mock
      standard: [standardMock],
      custom: []
    });
    expect(utils.safeDelete).toHaveBeenCalledTimes(1);
    expect(utils.safeDelete).toHaveBeenCalledWith(standardPath, {
      recursive: true,
      useTrash: false
    });
    expect(utils.createDirectory).toHaveBeenCalledTimes(2);
    expect(utils.createDirectory).toHaveBeenCalledWith(standardPath);
    expect(utils.createDirectory).toHaveBeenCalledWith(outputFolderPath);
    expect(utils.writeFile).toHaveBeenCalledTimes(1);
    expect(utils.writeFile).toHaveBeenCalledWith(
      join(standardPath, 'Account.json'),
      JSON.stringify(standardMock, null, 2)
    );
  });

  it('Should delete and recreate customObjects folder', async () => {
    await generateAllMetadata({
      // @ts-expect-error - partial mock
      custom: [customMock],
      standard: []
    });
    expect(utils.safeDelete).toHaveBeenCalledTimes(1);
    expect(utils.safeDelete).toHaveBeenCalledWith(customPath, {
      recursive: true,
      useTrash: false
    });
    expect(utils.createDirectory).toHaveBeenCalledTimes(2);
    expect(utils.createDirectory).toHaveBeenCalledWith(customPath);
    expect(utils.createDirectory).toHaveBeenCalledWith(outputFolderPath);
    expect(utils.writeFile).toHaveBeenCalledTimes(1);
    expect(utils.writeFile).toHaveBeenCalledWith(join(customPath, 'Foo__c.json'), JSON.stringify(customMock, null, 2));
  });

  it('Should delete and recreate both folders', async () => {
    await generateAllMetadata({
      // @ts-expect-error - partial mock
      custom: [customMock],
      // @ts-expect-error - partial mock
      standard: [standardMock]
    });
    expect(utils.safeDelete).toHaveBeenCalledTimes(2);
    expect(utils.safeDelete).toHaveBeenCalledWith(customPath, {
      recursive: true,
      useTrash: false
    });
    expect(utils.safeDelete).toHaveBeenCalledWith(standardPath, {
      recursive: true,
      useTrash: false
    });
    expect(utils.createDirectory).toHaveBeenCalledTimes(3);
    expect(utils.createDirectory).toHaveBeenCalledWith(customPath);
    expect(utils.createDirectory).toHaveBeenCalledWith(standardPath);
    expect(utils.createDirectory).toHaveBeenCalledWith(outputFolderPath);
    expect(utils.writeFile).toHaveBeenCalledTimes(2);
    expect(utils.writeFile).toHaveBeenCalledWith(join(customPath, 'Foo__c.json'), JSON.stringify(customMock, null, 2));
    expect(utils.writeFile).toHaveBeenCalledWith(
      join(standardPath, 'Account.json'),
      JSON.stringify(standardMock, null, 2)
    );
  });
});
