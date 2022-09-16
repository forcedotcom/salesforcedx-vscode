import {
  SfdxCommandBuilder,
  SFDX_COMMAND
} from '../../../src/cli/sfdxCommandBuilder';

describe('sfdxCommandBuilder unit tests.', () => {
  it('Should default to sfdx command.', () => {
    const sfdxCommandBuilderInst = new SfdxCommandBuilder();
    expect(sfdxCommandBuilderInst.command).toEqual(SFDX_COMMAND);
  });
});
