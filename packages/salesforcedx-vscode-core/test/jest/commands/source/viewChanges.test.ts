/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { viewAllChanges, viewLocalChanges, viewRemoteChanges } from '../../../../src/commands';
import * as commandlet from '../../../../src/commands/util/sfCommandlet';

describe('viewChanges', () => {
  let runMock: jest.Mock<any, any>;
  let sfCommandletMocked: jest.SpyInstance<any, any>;

  beforeEach(() => {
    // Arrange
    runMock = jest.fn();
    sfCommandletMocked = jest.spyOn(commandlet, 'SfCommandlet').mockImplementation((): any => {
      return {
        run: runMock
      };
    });
  });

  describe('viewAllChanges', () => {
    it('should get both local and remote changes', () => {
      // Act
      viewAllChanges();

      // Assert
      expect(sfCommandletMocked).toHaveBeenCalledTimes(1);
      expect(sfCommandletMocked.mock.calls[0][2].options).toEqual({
        local: true,
        remote: true
      });
      expect(runMock).toHaveBeenCalled();
    });
  });

  describe('viewLocalChanges', () => {
    it('should get local changes', () => {
      viewLocalChanges();

      expect(sfCommandletMocked).toHaveBeenCalledTimes(1);
      expect(sfCommandletMocked.mock.calls[0][2].options).toEqual({
        local: true,
        remote: false
      });
      expect(runMock).toHaveBeenCalled();
    });
  });

  describe('viewRemoteChanges', () => {
    it('should get remote changes', () => {
      viewRemoteChanges();

      expect(sfCommandletMocked).toHaveBeenCalledTimes(1);
      expect(sfCommandletMocked.mock.calls[0][2].options).toEqual({
        local: false,
        remote: true
      });
      expect(runMock).toHaveBeenCalled();
    });
  });
});
