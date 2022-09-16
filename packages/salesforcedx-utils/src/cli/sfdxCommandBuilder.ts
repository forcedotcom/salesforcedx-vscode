import { CommandBuilder } from './commandBuilder';

export const SFDX_COMMAND = 'sfdx';
export class SfdxCommandBuilder extends CommandBuilder {
  public constructor() {
    super(SFDX_COMMAND);
  }
}
