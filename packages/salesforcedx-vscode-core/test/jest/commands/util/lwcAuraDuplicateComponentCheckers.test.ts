/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import { LwcAuraDuplicateComponentCheckerForRename, lwcAuraDuplicateComponentCheckersTesting as lwcForTestng } from '../../../../src/commands/util';
import { nls } from '../../../../src/messages';
import { ContinueOrCancel, componentUtils } from '../../../../src/util';

jest.mock('fs');
jest.mock('path');
jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  notificationService: {
    showErrorMessage: jest.fn()
  }
}));

describe('LwcAuraDuplicateComponentCheckerForRename', () => {
  const sourceFsPath = '/path/to/source';
  let checker: LwcAuraDuplicateComponentCheckerForRename;

  beforeEach(() => {
    checker = new LwcAuraDuplicateComponentCheckerForRename(sourceFsPath);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return CANCEL if inputs is not Continue', async () => {
    const inputs = { type: 'CANCEL', msg: 'Some error' } as ContinueOrCancel;
    const result = await checker.check(inputs);
    expect(result).toEqual(inputs);
  });

  it('should return CANCEL with nls.localized message if inputs.data is an array', async () => {
    const inputs = { type: 'CONTINUE', data: ['component1', 'component2'] };
    const result = await checker.check(inputs as ContinueOrCancel);
    expect(result).toEqual({ type: 'CANCEL', msg: nls.localize('rename_not_supported') });
  });

  it('should return CANCEL with nls.localized message if data is not a component name', async () => {
    const inputs = { type: 'CONTINUE', data: { notName: 'value' } };
    const result = await checker.check(inputs as ContinueOrCancel);
    expect(result).toEqual({ type: 'CANCEL', msg: nls.localize('input_no_component_name') });
  });

  it('should return CANCEL with nls.localized message if name is empty', async () => {
    const inputs = { type: 'CONTINUE', data: { name: '' } };
    const result = await checker.check(inputs as ContinueOrCancel);
    expect(result).toEqual({ type: 'CANCEL', msg: nls.localize('component_empty') });
  });

  it('should call getComponentPath and check for duplicates', async () => {
    const inputs = { type: 'CONTINUE', data: { name: 'componentName' } };
    const componentPath = '/path/to/component';
    const items = ['file1', 'file2'];

    jest.spyOn(fs.promises, 'readdir').mockResolvedValue(items as any);
    jest.spyOn(componentUtils, 'getComponentPath').mockResolvedValue(componentPath);
    jest.spyOn(lwcForTestng, 'checkForDuplicateName').mockResolvedValue(undefined);
    jest.spyOn(lwcForTestng, 'checkForDuplicateInComponent').mockResolvedValue(undefined);

    const result = await checker.check(inputs as ContinueOrCancel);

    expect(componentUtils.getComponentPath).toHaveBeenCalledWith(sourceFsPath);
    expect(fs.promises.readdir).toHaveBeenCalledWith(componentPath);
    expect(lwcForTestng.checkForDuplicateName).toHaveBeenCalledWith(componentPath, 'componentName');
    expect(lwcForTestng.checkForDuplicateInComponent).toHaveBeenCalledWith(componentPath, 'componentName', items);
    expect(result).toEqual({ type: 'CONTINUE', data: inputs.data });
  });

  it('should throw an error if duplicate file name is found', async () => {
    const inputs = { type: 'CONTINUE', data: { name: 'duplicateName' } };
    const componentPath = '/path/to/component';
    const items = ['duplicateName.html'];

    jest.spyOn(fs.promises, 'readdir').mockResolvedValue(items as any);
    jest.spyOn(componentUtils, 'getComponentPath').mockResolvedValue(componentPath);
    jest.spyOn(lwcForTestng, 'checkForDuplicateName').mockResolvedValue(undefined);
    jest.spyOn(lwcForTestng, 'checkForDuplicateInComponent').mockImplementation(() => {
      throw new Error(nls.localize('rename_input_dup_file_name_error'));
    });

    await expect(checker.check(inputs as ContinueOrCancel)).rejects.toThrow(nls.localize('rename_input_dup_file_name_error'));
  });
});

