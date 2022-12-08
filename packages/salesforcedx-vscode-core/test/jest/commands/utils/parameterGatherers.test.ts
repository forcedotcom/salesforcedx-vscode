/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import {
  CANCEL,
  CONTINUE,
  SelectFileName
} from '../../../../src/commands/util/parameterGatherers';
import { nls } from '../../../../src/messages';

describe('ParameterGatherers Unit Tests.', () => {
  describe('SelectFileName', () => {
    it('Should default to infinity for size of file name if not provided.', async () => {
      const fileName = 'thisisasuperlongfilenamebutnottoolong';
      (vscode.window.showInputBox as any).mockImplementation(
        (option: vscode.InputBoxOptions) => {
          expect(option.prompt).toEqual(
            nls.localize('parameter_gatherer_enter_file_name')
          );
          expect(option.validateInput).not.toBeDefined();
          return fileName;
        }
      );
      const selectFileNameInst = new SelectFileName();
      const result = await selectFileNameInst.gather();
      expect(result).toEqual({
        type: CONTINUE,
        data: { fileName }
      });
    });

    it('Should cancel if filename is longer then limit.', async () => {
      const fileNameWithEleven = 'ithastotals';
      const limit = 10;
      (vscode.window.showInputBox as any).mockImplementation(
        (option: vscode.InputBoxOptions) => {
          expect(option.prompt).toEqual(
            nls.localize('parameter_gatherer_enter_file_name')
          );
          expect(option.validateInput).toBeDefined();

          const validationResults =
            option.validateInput && option.validateInput(fileNameWithEleven);
          expect(validationResults).toEqual(
            nls
              .localize(
                'parameter_gathere_file_name_max_length_validation_error_message'
              )
              .replace('{0}', limit.toString())
          );
          return null;
        }
      );
      expect(fileNameWithEleven.length).toBeGreaterThan(limit);
      const selectFileNameInst = new SelectFileName(limit);

      const result = await selectFileNameInst.gather();
      expect(result).toEqual({ type: CANCEL });
    });

    it('Should continue if filename is equal to the limit.', async () => {
      const fileNameWithTen = 'ithastotal';
      const limit = 10;
      (vscode.window.showInputBox as any).mockImplementation(
        (option: vscode.InputBoxOptions) => {
          expect(option.prompt).toEqual(
            nls.localize('parameter_gatherer_enter_file_name')
          );
          expect(option.validateInput).toBeDefined();

          const validationResults =
            option.validateInput && option.validateInput(fileNameWithTen);
          expect(validationResults).toBeNull();

          return fileNameWithTen;
        }
      );
      expect(fileNameWithTen.length).toEqual(limit);
      const selectFileNameInst = new SelectFileName(limit);

      const result = await selectFileNameInst.gather();
      expect(result).toEqual({
        type: CONTINUE,
        data: { fileName: fileNameWithTen }
      });
    });

    it('Should continue if filename is less than limit.', async () => {
      const fileNameWithFive = 'ithas';
      const limit = 10;
      (vscode.window.showInputBox as any).mockImplementation(
        (option: vscode.InputBoxOptions) => {
          expect(option.prompt).toEqual(
            nls.localize('parameter_gatherer_enter_file_name')
          );
          expect(option.validateInput).toBeDefined();

          const validationResults =
            option.validateInput && option.validateInput(fileNameWithFive);
          expect(validationResults).toBeNull();

          return fileNameWithFive;
        }
      );
      expect(fileNameWithFive.length).toBeLessThan(limit);
      const selectFileNameInst = new SelectFileName(limit);

      const result = await selectFileNameInst.gather();
      expect(result).toEqual({
        type: CONTINUE,
        data: { fileName: fileNameWithFive }
      });
    });
  });
});
