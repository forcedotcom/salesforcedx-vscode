import { SF_COMMAND } from '../constants';
import { CommandBuilder } from './commandBuilder';

export class SfCommandBuilder extends CommandBuilder {
  public constructor() {
    super(SF_COMMAND);
  }
}
