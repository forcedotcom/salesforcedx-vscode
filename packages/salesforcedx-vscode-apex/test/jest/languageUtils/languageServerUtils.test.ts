/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import * as child_process from 'child_process';
import { UBER_JAR_NAME } from '../../../src/constants';
import { languageServerUtils } from '../../../src/languageUtils';
import { getTelemetryService } from '../../../src/telemetry/telemetry';
import { MockTelemetryService } from '../telemetry/mockTelemetryService';

jest.mock('../../../src/telemetry/telemetry', () => ({
  getTelemetryService: jest.fn()
}));

describe('languageServerUtils', () => {
  describe('findAndCheckOrphanedProcesses', () => {
    beforeEach(() => {
      (getTelemetryService as jest.Mock).mockResolvedValue(new MockTelemetryService());
    });

    it('should return empty array if no processes found', async () => {
      jest.spyOn(child_process, 'execSync').mockReturnValue(Buffer.from(''));
      jest.spyOn(languageServerUtils, 'canRunCheck').mockResolvedValue(true);

      const result = await languageServerUtils.findAndCheckOrphanedProcesses();
      expect(result).to.have.lengthOf(0);
    });
    it('should return empty array if no orphaned processes found', async () => {
      jest
        .spyOn(child_process, 'execSync')
        .mockReturnValueOnce(Buffer.from(`1234 5678 ${UBER_JAR_NAME}`))
        .mockReturnValueOnce(Buffer.from(''));
      jest.spyOn(languageServerUtils, 'canRunCheck').mockResolvedValue(true);

      const result = await languageServerUtils.findAndCheckOrphanedProcesses();
      expect(result).to.have.lengthOf(0);
    });
    it('should return array of orphaned processes', async () => {
      jest
        .spyOn(child_process, 'execSync')
        .mockReturnValueOnce(Buffer.from(`1234 5678 ${UBER_JAR_NAME}`))
        .mockImplementationOnce(() => {
          throw new Error();
        });
      jest.spyOn(languageServerUtils, 'canRunCheck').mockResolvedValue(true);

      const result = await languageServerUtils.findAndCheckOrphanedProcesses();
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.have.property('pid', 1234);
    });
  });
});
