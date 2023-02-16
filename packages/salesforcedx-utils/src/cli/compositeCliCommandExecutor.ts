import { CancellationToken } from '../types';
import { Command } from './command';
import { CompositeCliCommandExecution } from './compositeCliCommandExecution';

export class CompositeCliCommandExecutor {
  private readonly command: Command;

  public constructor(commands: Command) {
    this.command = commands;
  }

  public execute(
    cancellationToken?: CancellationToken
  ): CompositeCliCommandExecution {
    return new CompositeCliCommandExecution(this.command, cancellationToken);
  }
}
