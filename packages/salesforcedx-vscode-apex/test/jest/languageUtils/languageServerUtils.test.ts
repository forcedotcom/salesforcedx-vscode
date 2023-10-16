/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import * as crossSpawn from 'cross-spawn';
import { UBER_JAR_NAME } from '../../../src/constants';
import { findAndCheckOrphanedProcesses } from '../../../src/languageUtils/languageServerUtils';

describe('languageServerUtils', () => {
  describe('findAndCheckOrphanedProcesses', () => {
    it('should return empty array if no processes found', () => {
      jest
        .spyOn(crossSpawn, 'sync')
        .mockReturnValue({
          stdout: Buffer.from(''),
          pid: 0,
          output: [],
          stderr: Buffer.from(''),
          status: 0,
          signal: ''
        });

      const result = findAndCheckOrphanedProcesses();
      expect(result).to.have.lengthOf(0);
    });
    it('should return empty array if no orphaned processes found', () => {
      jest
        .spyOn(crossSpawn, 'sync')
        .mockReturnValueOnce({
          stdout: Buffer.from(`1234 5678 ${UBER_JAR_NAME}`),
          pid: 0,
          output: [],
          stderr: Buffer.from(''),
          status: 0,
          signal: ''
        })
        .mockReturnValueOnce({
          stdout: Buffer.from(''),
          pid: 0,
          output: [],
          stderr: Buffer.from(''),
          status: 0,
          signal: ''
        });
      const result = findAndCheckOrphanedProcesses();
      expect(result).to.have.lengthOf(0);
    });
    it('should return array of orphaned processes', () => {
      jest
        .spyOn(crossSpawn, 'sync')
        .mockReturnValueOnce({
          stdout: Buffer.from(`1234 5678 ${UBER_JAR_NAME}`),
          pid: 0,
          output: [],
          stderr: Buffer.from(''),
          status: 0,
          signal: ''
        })
        .mockImplementationOnce(() => {
          throw new Error();
        });

      const result = findAndCheckOrphanedProcesses();
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.have.property('pid', 1234);
    });
  });
});
