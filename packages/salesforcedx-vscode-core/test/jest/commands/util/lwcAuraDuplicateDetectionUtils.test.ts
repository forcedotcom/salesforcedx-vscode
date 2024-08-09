/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs/promises';
import { checkForDuplicateInComponent, checkForDuplicateName, isNameMatch } from '../../../../src/commands/util/lwcAuraDuplicateDetectionUtils';

jest.mock('fs');
jest.mock('path');

describe('lwcAuraDuplicateComponentCheckers', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkForDuplicateInComponent', () => {
    it('should not throw an error if there are no duplicates', async () => {
      const componentPath = '/path/to/component';
      const newName = 'newComponent';
      const items = ['file1.js', 'file2.js'];
      await expect(checkForDuplicateInComponent(componentPath, newName, items)).resolves.not.toThrow();
    });

    it('should throw an error if there is a duplicate in the component directory', async () => {
      const componentPath = '/path/to/component';
      const newName = 'file1';
      const items = ['file1.js', 'file2.js'];
      await expect(checkForDuplicateInComponent(componentPath, newName, items)).rejects.toThrow('Duplicate file name error');
    });

    it('should check the __tests__ directory for duplicates', async () => {
      const componentPath = '/path/to/component';
      const newName = 'testFile';
      const items = ['file1.js', 'file2.js', '__tests__'];

      jest.spyOn(fs, 'readdir').mockResolvedValue(['testFile.js'] as any[]);

      await expect(checkForDuplicateInComponent(componentPath, newName, items)).rejects.toThrow('Duplicate file name error');
    });
  });

  describe('isNameMatch', () => {
    it('should return true for matching LWC component names', () => {
      const item = 'component.html';
      const componentName = 'component';
      const componentPath = '/path/to/component';
      expect(isNameMatch(item, componentName, componentPath)).toBe(true);
    });

    it('should return false for non-matching LWC component names', () => {
      const item = 'otherComponent.html';
      const componentName = 'component';
      const componentPath = '/path/to/component';
      expect(isNameMatch(item, componentName, componentPath)).toBe(false);
    });

    it('should return true for matching Aura component names', () => {
      const item = 'componentController.js';
      const componentName = 'component';
      const componentPath = '/path/to/component';
      expect(isNameMatch(item, componentName, componentPath)).toBe(true);
    });

    it('should return false for non-matching Aura component names', () => {
      const item = 'otherComponentController.js';
      const componentName = 'component';
      const componentPath = '/path/to/component';
      expect(isNameMatch(item, componentName, componentPath)).toBe(false);
    });
  });

  describe('checkForDuplicateName', () => {
    it('should not throw an error if there are no duplicates', async () => {
      const componentPath = '/path/to/component';
      const newName = 'newComponent';
      await expect(checkForDuplicateName(componentPath, newName)).resolves.not.toThrow();
    });

    it('should throw an error if there is a duplicate', async () => {
      const componentPath = '/path/to/component';
      const newName = 'existingComponent';
      await expect(checkForDuplicateName(componentPath, newName)).rejects.toThrow('Duplicate name error');
    });
  });
});
