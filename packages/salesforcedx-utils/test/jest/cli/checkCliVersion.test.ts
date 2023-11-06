import { CheckCliVersion } from '../../../src';

describe('CheckCliVersion unit tests.', () => {

  const validSFVersion = '@salesforce/cli/2.15.9 darwin-arm64 node-v18.17.1';
  const validSFDXVersion = 'sfdx-cli/7.209.6 win32-x64 node-v18.15.0';
  const outdatedSFVersion = '@salesforce/cli/1.87.0 darwin-arm64 node-v18.17.1';
  const outdatedSFDXVersion = 'sfdx-cli/7.183.1 darwin-arm64 node-v16.19.1';
  const emptyString = '';
  const dummyText = 'dummy text';

  it('Should create instance.', () => {
    const checkCliVersion = new CheckCliVersion();
    expect(checkCliVersion).toBeInstanceOf(CheckCliVersion);
  });

  it('SF v2 should be a valid CLI version', async () => {
    const checkCliVersion = new CheckCliVersion();
    const result = await checkCliVersion.validateCliVersion(validSFVersion);
    expect(result).toBe(1);
  });

  it('SF v1 should NOT be a valid CLI version', async () => {
    const checkCliVersion = new CheckCliVersion();
    const result = await checkCliVersion.validateCliVersion(outdatedSFVersion);
    expect(result).toBe(2);
  });

  it('SFDX >=v1.193.2 should be a valid CLI version', async () => {
    const checkCliVersion = new CheckCliVersion();
    const result = await checkCliVersion.validateCliVersion(validSFDXVersion);
    expect(result).toBe(1);
  });

  it('SFDX <v1.193.2 should NOT be a valid CLI version', async () => {
    const checkCliVersion = new CheckCliVersion();
    const result = await checkCliVersion.validateCliVersion(outdatedSFDXVersion);
    expect(result).toBe(2);
  });

  it('Empty string should NOT be a valid CLI version', async () => {
    const checkCliVersion = new CheckCliVersion();
    const result = await checkCliVersion.validateCliVersion(emptyString);
    expect(result).toBe(3);
  });

  it('Dummy text should NOT be a valid CLI version', async () => {
    const checkCliVersion = new CheckCliVersion();
    const result = await checkCliVersion.validateCliVersion(dummyText);
    expect(result).toBe(3);
  });

});