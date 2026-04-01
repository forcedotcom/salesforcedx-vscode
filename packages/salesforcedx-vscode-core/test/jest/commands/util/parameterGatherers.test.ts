/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { SelectFileName, SelectLwcComponentType } from '../../../../src/commands/util/parameterGatherers';
import { nls } from '../../../../src/messages';
import { SalesforceProjectConfig } from '../../../../src/salesforceProject';

describe('ParameterGatherers Unit Tests.', () => {
  describe('SelectFileName', () => {
    it('Should default to infinity for size of file name if not provided.', async () => {
      const fileName = 'thisisasuperlongfilenamebutnottoolong';
      (vscode.window.showInputBox as any).mockImplementation((option: vscode.InputBoxOptions) => {
        expect(option.prompt).toEqual(nls.localize('parameter_gatherer_enter_file_name'));
        expect(option.validateInput).not.toBeDefined();
        return fileName;
      });
      const selectFileNameInst = new SelectFileName();
      const result = await selectFileNameInst.gather();
      expect(result).toEqual({
        type: 'CONTINUE',
        data: { fileName }
      });
    });

    it('Should cancel if filename is longer then limit.', async () => {
      const fileNameWithEleven = 'ithastotals';
      const limit = 10;
      (vscode.window.showInputBox as any).mockImplementation((option: vscode.InputBoxOptions) => {
        expect(option.prompt).toEqual(nls.localize('parameter_gatherer_enter_file_name'));
        expect(option.validateInput).toBeDefined();

        const validationResults = option.validateInput?.(fileNameWithEleven);
        expect(validationResults).toEqual(
          nls
            .localize('parameter_gatherer_file_name_max_length_validation_error_message')
            .replace('{0}', limit.toString())
        );
        return null;
      });
      expect(fileNameWithEleven.length).toBeGreaterThan(limit);
      const selectFileNameInst = new SelectFileName(limit);

      const result = await selectFileNameInst.gather();
      expect(result).toEqual({ type: 'CANCEL' });
    });

    it('Should continue if filename is equal to the limit.', async () => {
      const fileNameWithTen = 'ithastotal';
      const limit = 10;
      (vscode.window.showInputBox as any).mockImplementation((option: vscode.InputBoxOptions) => {
        expect(option.prompt).toEqual(nls.localize('parameter_gatherer_enter_file_name'));
        expect(option.validateInput).toBeDefined();

        const validationResults = option.validateInput?.(fileNameWithTen);
        expect(validationResults).toBeNull();

        return fileNameWithTen;
      });
      expect(fileNameWithTen.length).toEqual(limit);
      const selectFileNameInst = new SelectFileName(limit);

      const result = await selectFileNameInst.gather();
      expect(result).toEqual({
        type: 'CONTINUE',
        data: { fileName: fileNameWithTen }
      });
    });

    it('Should continue if filename is less than limit.', async () => {
      const fileNameWithFive = 'ithas';
      const limit = 10;
      (vscode.window.showInputBox as any).mockImplementation((option: vscode.InputBoxOptions) => {
        expect(option.prompt).toEqual(nls.localize('parameter_gatherer_enter_file_name'));
        expect(option.validateInput).toBeDefined();

        const validationResults = option.validateInput?.(fileNameWithFive);
        expect(validationResults).toBeNull();

        return fileNameWithFive;
      });
      expect(fileNameWithFive.length).toBeLessThan(limit);
      const selectFileNameInst = new SelectFileName(limit);

      const result = await selectFileNameInst.gather();
      expect(result).toEqual({
        type: 'CONTINUE',
        data: { fileName: fileNameWithFive }
      });
    });
  });

  describe('SelectLwcComponentType', () => {
    let getValueSpy: jest.SpyInstance;
    let getConfigSpy: jest.SpyInstance;
    let showInfoMessageSpy: jest.SpyInstance;

    beforeEach(() => {
      getValueSpy = jest.spyOn(SalesforceProjectConfig, 'getValue');
      getConfigSpy = jest.spyOn(vscode.workspace, 'getConfiguration');
      showInfoMessageSpy = jest.spyOn(vscode.window, 'showInformationMessage');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('Should return TypeScript when defaultLwcLanguage is typescript', async () => {
      getValueSpy.mockResolvedValue('typescript');
      const selectLwcComponentTypeInstance = new SelectLwcComponentType();
      const showMenuSpy = jest.spyOn(selectLwcComponentTypeInstance, 'showMenu');

      const result = await selectLwcComponentTypeInstance.gather();

      expect(result).toEqual({
        type: 'CONTINUE',
        data: { extension: 'TypeScript' }
      });
      expect(showMenuSpy).not.toHaveBeenCalled();
    });

    it('Should return JavaScript when defaultLwcLanguage is javascript', async () => {
      getValueSpy.mockResolvedValue('javascript');
      const selectLwcComponentTypeInstance = new SelectLwcComponentType();
      const showMenuSpy = jest.spyOn(selectLwcComponentTypeInstance, 'showMenu');

      const result = await selectLwcComponentTypeInstance.gather();

      expect(result).toEqual({
        type: 'CONTINUE',
        data: { extension: 'JavaScript' }
      });
      expect(showMenuSpy).not.toHaveBeenCalled();
    });

    it('Should prompt user when defaultLwcLanguage is undefined', async () => {
      getValueSpy.mockResolvedValue(undefined);
      const mockConfig = { get: jest.fn().mockReturnValue(false) };
      getConfigSpy.mockReturnValue(mockConfig);

      const selectLwcComponentTypeInstance = new SelectLwcComponentType();
      const showMenuSpy = jest
        .spyOn(selectLwcComponentTypeInstance, 'showMenu')
        .mockResolvedValue('TypeScript');

      const result = await selectLwcComponentTypeInstance.gather();

      expect(result).toEqual({
        type: 'CONTINUE',
        data: { extension: 'TypeScript' }
      });
      expect(showMenuSpy).toHaveBeenCalled();
    });

    it('Should fall back to legacy flag when defaultLwcLanguage throws error', async () => {
      getValueSpy.mockRejectedValue(new Error('Config not available'));
      const mockConfig = { get: jest.fn().mockReturnValue(true) };
      getConfigSpy.mockReturnValue(mockConfig);
      showInfoMessageSpy.mockResolvedValue(undefined);

      const selectLwcComponentTypeInstance = new SelectLwcComponentType();
      const showMenuSpy = jest.spyOn(selectLwcComponentTypeInstance, 'showMenu');

      const result = await selectLwcComponentTypeInstance.gather();

      expect(result).toEqual({
        type: 'CONTINUE',
        data: { extension: 'TypeScript' }
      });
      expect(showInfoMessageSpy).toHaveBeenCalled();
      expect(showMenuSpy).not.toHaveBeenCalled();
    });

    it('Should show deprecation warning for legacy flag', async () => {
      getValueSpy.mockResolvedValue(undefined);
      const mockConfig = { get: jest.fn().mockReturnValue(true) };
      getConfigSpy.mockReturnValue(mockConfig);
      showInfoMessageSpy.mockResolvedValue(undefined);

      const selectLwcComponentTypeInstance = new SelectLwcComponentType();

      const result = await selectLwcComponentTypeInstance.gather();

      expect(result).toEqual({
        type: 'CONTINUE',
        data: { extension: 'TypeScript' }
      });
      expect(showInfoMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('deprecated')
      );
    });

    it('Should prompt user when both configs are not set', async () => {
      getValueSpy.mockResolvedValue(undefined);
      const mockConfig = { get: jest.fn().mockReturnValue(false) };
      getConfigSpy.mockReturnValue(mockConfig);

      const selectLwcComponentTypeInstance = new SelectLwcComponentType();
      const showMenuSpy = jest
        .spyOn(selectLwcComponentTypeInstance, 'showMenu')
        .mockResolvedValue('JavaScript');

      const result = await selectLwcComponentTypeInstance.gather();

      expect(result).toEqual({
        type: 'CONTINUE',
        data: { extension: 'JavaScript' }
      });
      expect(showMenuSpy).toHaveBeenCalledWith(['JavaScript', 'TypeScript'], 'parameter_gatherer_select_lwc_type');
    });

    it('Should return CANCEL when user cancels prompt', async () => {
      getValueSpy.mockResolvedValue(undefined);
      const mockConfig = { get: jest.fn().mockReturnValue(false) };
      getConfigSpy.mockReturnValue(mockConfig);

      const selectLwcComponentTypeInstance = new SelectLwcComponentType();
      const showMenuSpy = jest
        .spyOn(selectLwcComponentTypeInstance, 'showMenu')
        .mockResolvedValue(undefined);

      const result = await selectLwcComponentTypeInstance.gather();

      expect(result).toEqual({
        type: 'CANCEL'
      });
      expect(showMenuSpy).toHaveBeenCalled();
    });
  });
});
