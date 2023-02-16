import { SFDX_COMMAND } from '../constants';
import { CommandBuilder } from './commandBuilder';

export class SfdxCommandBuilder extends CommandBuilder {
  public constructor() {
    super(SFDX_COMMAND);
  }
}
