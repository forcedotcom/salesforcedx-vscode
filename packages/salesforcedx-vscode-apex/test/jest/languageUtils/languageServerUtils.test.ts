/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import * as child_process from 'child_process';
import { findAndCheckOrphanedProcesses } from '../../../src/languageUtils/languageServerUtils';

describe('languageServerUtils', () => {
  describe('findAndCheckOrphanedProcesses', () => {
    it('should return empty array if no processes found', () => {
      jest
        .spyOn(child_process, 'execSync')
        .mockReturnValue(Buffer.from(''));

      const result = findAndCheckOrphanedProcesses();
      expect(result).to.have.lengthOf(0);
    });
    it('should return empty array if no orphaned processes found', () => {
      jest
        .spyOn(child_process, 'execSync')
        .mockReturnValueOnce(Buffer.from('1234 5678 jorje'))
        .mockReturnValueOnce(Buffer.from(''));
      const result = findAndCheckOrphanedProcesses();
      expect(result).to.have.lengthOf(0);
    });
    it('should return array of orphaned processes', () => {
      jest
        .spyOn(child_process, 'execSync')
        .mockReturnValueOnce(Buffer.from('1234 5678 jorje'))
        .mockImplementationOnce(() => {
          throw new Error();
        });

      const result = findAndCheckOrphanedProcesses();
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.have.property('pid', 1234);
    });
  });
});
