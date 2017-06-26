export interface Command {
  readonly command: string;
  readonly description?: string;
  readonly args: string[];
}

export { CommandBuilder, SfdxCommandBuilder } from './commandBuilder';
export { CliCommandExecutor, CommandExecution } from './commandExecutor';
