import { SfdxCommandBuilder } from '../../../src/cli/sfdxCommandBuilder';
import { SFDX_COMMAND } from '../../../src/constants';

describe('sfdxCommandBuilder unit tests.', () => {
  it('Should default to sfdx command.', () => {
    const sfdxCommandBuilderInst = new SfdxCommandBuilder();
    expect(sfdxCommandBuilderInst.command).toEqual(SFDX_COMMAND);
  });
});
