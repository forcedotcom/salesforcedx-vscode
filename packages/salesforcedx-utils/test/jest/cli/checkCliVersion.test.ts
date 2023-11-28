import { CheckCliEnum, CheckCliVersion } from '../../../src';

describe('CheckCliVersion unit tests.', () => {

  const sfV2_string = '@salesforce/cli/2.15.9 darwin-arm64 node-v18.17.1';
  const sfdxV7_valid_string = 'sfdx-cli/7.209.6 win32-x64 node-v18.15.0';
  const sfV1_string = '@salesforce/cli/1.87.0 darwin-arm64 node-v18.17.1';
  const sfdxV7_outdated_string = 'sfdx-cli/7.183.1 darwin-arm64 node-v16.19.1';
  const noSFDX_string = 'No SFDX CLI';
  const noSF_string = 'No SF CLI';

  const sfV2_array = [2, 15, 9];
  const sfdxV7_valid_array = [7, 209, 6];
  const sfV1_array = [1, 87, 0];
  const sfdxV7_outdated_array = [7, 183, 1];
  const noSFDX_array = [-1];
  const noSF_array = [-1];

  it('Should create instance.', () => {
    const c = new CheckCliVersion();
    expect(c).toBeInstanceOf(CheckCliVersion);
  });

  /*
  Test cases for the parseSfdxCliVersion() function
  */
  it('Parse valid SFDX', async () => {
    const c = new CheckCliVersion();
    const result = await c.parseSfdxCliVersion(sfdxV7_valid_string);
    expect(result).toStrictEqual(sfdxV7_valid_array);
  });

  it('Parse outdated SFDX', async () => {
    const c = new CheckCliVersion();
    const result = await c.parseSfdxCliVersion(sfdxV7_outdated_string);
    expect(result).toStrictEqual(sfdxV7_outdated_array);
  });

  it('Parse valid SF v2', async () => {
    const c = new CheckCliVersion();
    const result = await c.parseSfdxCliVersion(sfV2_string);
    expect(result).toStrictEqual(sfV2_array);
  });

  it('Parse SFDX not installed', async () => {
    const c = new CheckCliVersion();
    const result = await c.parseSfdxCliVersion(noSFDX_string);
    expect(result).toStrictEqual(noSFDX_array);
  });

  /*
  Test cases for the parseSfCliVersion() function
  */
  it('Parse SF v1', async () => {
    const c = new CheckCliVersion();
    const result = await c.parseSfCliVersion(sfV1_string);
    expect(result).toStrictEqual(sfV1_array);
  });

  it('Parse SF v2', async () => {
    const c = new CheckCliVersion();
    const result = await c.parseSfCliVersion(sfV2_string);
    expect(result).toStrictEqual(sfV2_array);
  });

  it('Parse SF not installed', async () => {
    const c = new CheckCliVersion();
    const result = await c.parseSfCliVersion(noSF_string);
    expect(result).toStrictEqual(noSF_array);
  });

  /*
  Test cases for the validateCliInstallationAndVersion() function
  */
  it('Case 1: No Salesforce CLI installed - should fail', async () => {
    const c = new CheckCliVersion();
    const result = await c.validateCliInstallationAndVersion(noSFDX_array, noSF_array);
    expect(result).toStrictEqual(CheckCliEnum.cliNotInstalled);
  });

  it('Case 2: Only SF v1 installed - should fail', async () => {
    const c = new CheckCliVersion();
    const result = await c.validateCliInstallationAndVersion(noSFDX_array, sfV1_array);
    expect(result).toStrictEqual(CheckCliEnum.onlySFv1);
  });

  it('Case 3: Both SFDX v7 (outdated) and SF v2 installed - should fail', async () => {
    const c = new CheckCliVersion();
    const result = await c.validateCliInstallationAndVersion(sfdxV7_outdated_array, sfV2_array);
    expect(result).toStrictEqual(CheckCliEnum.bothSFDXAndSFInstalled);
  });

  it('Case 4: Both SFDX v7 (valid) and SF v2 installed - should fail', async () => {
    const c = new CheckCliVersion();
    const result = await c.validateCliInstallationAndVersion(sfdxV7_valid_array, sfV2_array);
    expect(result).toStrictEqual(CheckCliEnum.bothSFDXAndSFInstalled);
  });

  it('Case 5: Only SFDX v7 (outdated) installed - should fail', async () => {
    const c = new CheckCliVersion();
    const result = await c.validateCliInstallationAndVersion(sfdxV7_outdated_array, noSF_array);
    expect(result).toStrictEqual(CheckCliEnum.outdatedSFDXVersion);
  });

  it('Case 6: Only SFDX v7 (valid) installed - should activate Core extension', async () => {
    const c = new CheckCliVersion();
    const result = await c.validateCliInstallationAndVersion(sfdxV7_valid_array, noSF_array);
    expect(result).toStrictEqual(CheckCliEnum.validCli);
  });

  it('Case 7: SFDX v7 (outdated) and SF v1 installed - should fail', async () => {
    const c = new CheckCliVersion();
    const result = await c.validateCliInstallationAndVersion(sfdxV7_outdated_array, sfV1_array);
    expect(result).toStrictEqual(CheckCliEnum.outdatedSFDXVersion);
  });

  it('Case 8: SFDX v7 (valid) and SF v1 installed - should activate Core extension', async () => {
    const c = new CheckCliVersion();
    const result = await c.validateCliInstallationAndVersion(sfdxV7_valid_array, sfV1_array);
    expect(result).toStrictEqual(CheckCliEnum.validCli);
  });

  it('Case 9: Only SF v2 installed - should activate Core extension', async () => {
    const c = new CheckCliVersion();
    const result = await c.validateCliInstallationAndVersion(sfV2_array, sfV2_array);
    expect(result).toStrictEqual(CheckCliEnum.validCli);
  });

});