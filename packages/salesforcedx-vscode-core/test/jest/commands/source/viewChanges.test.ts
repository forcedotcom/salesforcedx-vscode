/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  viewAllChanges,
  viewLocalChanges,
  viewRemoteChanges
} from '../../../../src/commands';
import * as commandlet from '../../../../src/commands/util/sfdxCommandlet';

describe('viewChanges', () => {
  let runMock: jest.Mock<any, any>;
  let sfdxCommandletMocked: jest.SpyInstance<any, any>;

  beforeEach(() => {
    // Arrange
    runMock = jest.fn();
    sfdxCommandletMocked = jest
      .spyOn(commandlet, 'SfdxCommandlet')
      .mockImplementation((): any => {
        return {
          run: runMock
        };
      });
  });

  describe('viewAllChanges', () => {
    it('should get both local and remote changes', async () => {
      // Act
      await viewAllChanges();

      // Assert
      expect(sfdxCommandletMocked).toHaveBeenCalledTimes(1);
      expect(sfdxCommandletMocked.mock.calls[0][2].options).toEqual({
        local: true,
        remote: true
      });
      expect(runMock).toHaveBeenCalled();
    });
  });

  describe('viewLocalChanges', () => {
    it('should get local changes', async () => {
      await viewLocalChanges();

      expect(sfdxCommandletMocked).toHaveBeenCalledTimes(1);
      expect(sfdxCommandletMocked.mock.calls[0][2].options).toEqual({
        local: true,
        remote: false
      });
      expect(runMock).toHaveBeenCalled();
    });
  });

  describe('viewRemoteChanges', () => {
    it('should get remote changes', async () => {
      await viewRemoteChanges();

      expect(sfdxCommandletMocked).toHaveBeenCalledTimes(1);
      expect(sfdxCommandletMocked.mock.calls[0][2].options).toEqual({
        local: false,
        remote: true
      });
      expect(runMock).toHaveBeenCalled();
    });
  });
});
