/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as child_process from 'child_process';
import { CliStatusEnum, CliVersionStatus } from '../../../src/cli/cliVersionStatus';

describe('CliVersionStatus unit tests.', () => {
  const sfV2_string = '@salesforce/cli/2.15.9 darwin-arm64 node-v18.17.1';
  const sfdxV7_valid_string = 'sfdx-cli/7.209.6 win32-x64 node-v18.15.0';
  const sfV1_string = '@salesforce/cli/1.87.0 darwin-arm64 node-v18.17.1';
  const sfdxV7_outdated_string = 'sfdx-cli/7.183.1 darwin-arm64 node-v16.19.1';
  const noSFDX_string = 'No CLI';
  const noSF_string = 'No CLI';

  const sfV2_parsed = '2.15.9';
  const sfdxV7_valid_parsed = '7.209.6';
  const sfV1_parsed = '1.87.0';
  const sfdxV7_outdated_parsed = '7.183.1';
  const noSFDX_parsed = '0.0.0';
  const noSF_parsed = '0.0.0';

  /*
  Test cases that produce a result for getSfdxCliVersion() and getSfCliVersion()
  */
  describe('Test cases that produce a result for getSfdxCliVersion() and getSfCliVersion()', () => {
    const fakeExecution = Buffer.from('fake result');
    const fakeResult = 'fake result';

    let executeSpy: jest.SpyInstance;
    beforeEach(() => {
      executeSpy = jest.spyOn(child_process, 'execSync').mockReturnValue(fakeExecution);
    });

    it('getSfdxCliVersion() - can get a result', async () => {
      const cliVersionStatus = new CliVersionStatus();
      const result = cliVersionStatus.getCliVersion(true);
      expect(result).toEqual(fakeResult);
      expect(executeSpy).toHaveBeenCalled();
    });

    it('getSfCliVersion() - can get a result', async () => {
      const cliVersionStatus = new CliVersionStatus();
      const result = cliVersionStatus.getCliVersion(false);
      expect(result).toEqual(fakeResult);
      expect(executeSpy).toHaveBeenCalled();
    });
  });

  /*
  Test cases that throw an error for getSfdxCliVersion() and getSfCliVersion()
  */
  describe('Test cases that throw an error for getSfdxCliVersion() and getSfCliVersion()', () => {
    const cliNotFound = 'No CLI';

    let executeSpy: jest.SpyInstance;
    beforeEach(() => {
      executeSpy = jest.spyOn(child_process, 'execSync').mockImplementationOnce(() => {
        throw new Error('simulate exception in execSync()');
      });
    });

    it('getSfdxCliVersion() - throws error', async () => {
      const cliVersionStatus = new CliVersionStatus();
      const result = cliVersionStatus.getCliVersion(true);
      expect(result).toEqual(cliNotFound);
      expect(executeSpy).toHaveBeenCalled();
    });

    it('getSfCliVersion() - can get a result', async () => {
      const cliVersionStatus = new CliVersionStatus();
      const result = cliVersionStatus.getCliVersion(false);
      expect(result).toEqual(cliNotFound);
      expect(executeSpy).toHaveBeenCalled();
    });
  });

  /*
  Test cases for the parseCliVersion() function
  */
  describe('Test cases for the parseCliVersion() function', () => {
    it('Parse valid SFDX', () => {
      const c = new CliVersionStatus();
      const result = c.parseCliVersion(sfdxV7_valid_string);
      expect(result).toStrictEqual(sfdxV7_valid_parsed);
    });

    it('Parse outdated SFDX', () => {
      const c = new CliVersionStatus();
      const result = c.parseCliVersion(sfdxV7_outdated_string);
      expect(result).toStrictEqual(sfdxV7_outdated_parsed);
    });

    it('Parse valid SF v2', () => {
      const c = new CliVersionStatus();
      const result = c.parseCliVersion(sfV2_string);
      expect(result).toStrictEqual(sfV2_parsed);
    });

    it('Parse SFDX not installed', () => {
      const c = new CliVersionStatus();
      const result = c.parseCliVersion(noSFDX_string);
      expect(result).toStrictEqual(noSFDX_parsed);
    });

    it('Parse SF v1', () => {
      const c = new CliVersionStatus();
      const result = c.parseCliVersion(sfV1_string);
      expect(result).toStrictEqual(sfV1_parsed);
    });

    it('Parse SF not installed', () => {
      const c = new CliVersionStatus();
      const result = c.parseCliVersion(noSF_string);
      expect(result).toStrictEqual(noSF_parsed);
    });
  });

  /*
  Test cases for the validateCliInstallationAndVersion() function
  */
  describe('Test cases for the validateCliInstallationAndVersion() function', () => {
    it('Case 1: No Salesforce CLI installed - should fail', () => {
      const c = new CliVersionStatus();
      const result = c.validateCliInstallationAndVersion(noSFDX_parsed, noSF_parsed);
      expect(result).toStrictEqual(CliStatusEnum.cliNotInstalled);
    });

    it('Case 2: Only SF v1 installed - should fail', () => {
      const c = new CliVersionStatus();
      const result = c.validateCliInstallationAndVersion(noSFDX_parsed, sfV1_parsed);
      expect(result).toStrictEqual(CliStatusEnum.onlySFv1);
    });

    it('Case 3: Both SFDX v7 (outdated) and SF v2 installed - should fail', () => {
      const c = new CliVersionStatus();
      const result = c.validateCliInstallationAndVersion(sfdxV7_outdated_parsed, sfV2_parsed);
      expect(result).toStrictEqual(CliStatusEnum.bothSFDXAndSFInstalled);
    });

    it('Case 4: Both SFDX v7 (valid) and SF v2 installed - should fail', () => {
      const c = new CliVersionStatus();
      const result = c.validateCliInstallationAndVersion(sfdxV7_valid_parsed, sfV2_parsed);
      expect(result).toStrictEqual(CliStatusEnum.bothSFDXAndSFInstalled);
    });

    it('Case 5: Only SFDX v7 (outdated) installed - should fail', () => {
      const c = new CliVersionStatus();
      const result = c.validateCliInstallationAndVersion(sfdxV7_outdated_parsed, noSF_parsed);
      expect(result).toStrictEqual(CliStatusEnum.outdatedSFDXVersion);
    });

    it('Case 6: Only SFDX v7 (valid) installed - should activate Core extension', () => {
      const c = new CliVersionStatus();
      const result = c.validateCliInstallationAndVersion(sfdxV7_valid_parsed, noSF_parsed);
      expect(result).toStrictEqual(CliStatusEnum.SFDXv7Valid);
    });

    it('Case 7: SFDX v7 (outdated) and SF v1 installed - should fail', () => {
      const c = new CliVersionStatus();
      const result = c.validateCliInstallationAndVersion(sfdxV7_outdated_parsed, sfV1_parsed);
      expect(result).toStrictEqual(CliStatusEnum.outdatedSFDXVersion);
    });

    it('Case 8: SFDX v7 (valid) and SF v1 installed - should activate Core extension', () => {
      const c = new CliVersionStatus();
      const result = c.validateCliInstallationAndVersion(sfdxV7_valid_parsed, sfV1_parsed);
      expect(result).toStrictEqual(CliStatusEnum.SFDXv7Valid);
    });

    it('Case 9: Only SF v2 installed - should activate Core extension', () => {
      const c = new CliVersionStatus();
      const result = c.validateCliInstallationAndVersion(sfV2_parsed, sfV2_parsed);
      expect(result).toStrictEqual(CliStatusEnum.SFv2);
    });
  });
});
