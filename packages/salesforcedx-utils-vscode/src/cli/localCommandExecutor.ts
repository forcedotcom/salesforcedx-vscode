import { EventEmitter } from 'events';
import 'rxjs/add/observable/fromEvent';
import { Command } from '.';
import { CancellationToken, CommandExecution } from './commandExecutor';

import { Observable } from 'rxjs/Observable';

export class LocalCommandExecution implements CommandExecution {
  public readonly command: Command;
  public readonly cancellationToken?: CancellationToken;
  public readonly processExitSubject: Observable<number | undefined>;
  public readonly processErrorSubject: Observable<Error | undefined>;
  public readonly stdoutSubject: Observable<Buffer | string>;
  public readonly stderrSubject: Observable<Buffer | string>;

  public cmdEmitter: EventEmitter = new EventEmitter();
  public static readonly EXIT_EVENT = 'exitEvent';
  public static readonly ERROR_EVENT = 'errorEvent';
  public static readonly STDOUT_EVENT = 'stdoutEvent';
  public static readonly STDERR_EVENT = 'stderrEvent';

  constructor(command: Command) {
    this.command = command;
    this.processExitSubject = Observable.fromEvent(
      this.cmdEmitter,
      LocalCommandExecution.EXIT_EVENT
    );
    this.processErrorSubject = Observable.fromEvent(
      this.cmdEmitter,
      LocalCommandExecution.ERROR_EVENT
    );
    this.stdoutSubject = Observable.fromEvent(
      this.cmdEmitter,
      LocalCommandExecution.STDOUT_EVENT
    );
    this.stderrSubject = Observable.fromEvent(
      this.cmdEmitter,
      LocalCommandExecution.STDERR_EVENT
    );
  }
}
