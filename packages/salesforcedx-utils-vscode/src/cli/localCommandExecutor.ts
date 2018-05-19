import { EventEmitter } from 'events';
import 'rxjs/add/observable/fromEvent';
import { Observable } from 'rxjs/Observable';
import { Command } from '.';
import { CancellationToken, CommandExecution } from './commandExecutor';

export class LocalCommandExecution implements CommandExecution {
  public static readonly EXIT_EVENT = 'exitEvent';
  public static readonly ERROR_EVENT = 'errorEvent';
  public static readonly STDOUT_EVENT = 'stdoutEvent';
  public static readonly STDERR_EVENT = 'stderrEvent';
  public static readonly SUCCESS_CODE = 0;
  public static readonly FAILURE_CODE = 1;

  public readonly command: Command;
  public readonly cancellationToken?: CancellationToken;
  public readonly processExitSubject: Observable<number | undefined>;
  public readonly processErrorSubject: Observable<Error | undefined>;
  public readonly stdoutSubject: Observable<Buffer | string>;
  public readonly stderrSubject: Observable<Buffer | string>;

  // NOTE: ERROR_EVENT is NOT named 'error' because that causes the EventEmitter to actually
  // throw an exception IF there is no listener
  public cmdEmitter: EventEmitter = new EventEmitter();

  constructor(command: Command) {
    this.command = command;
    this.processExitSubject = Observable.fromEvent(
      this.cmdEmitter,
      LocalCommandExecution.EXIT_EVENT
    ) as Observable<number>;
    this.processErrorSubject = Observable.fromEvent(
      this.cmdEmitter,
      LocalCommandExecution.ERROR_EVENT
    ) as Observable<Error>;
    this.stdoutSubject = Observable.fromEvent(
      this.cmdEmitter,
      LocalCommandExecution.STDOUT_EVENT
    ) as Observable<string>;
    this.stderrSubject = Observable.fromEvent(
      this.cmdEmitter,
      LocalCommandExecution.STDERR_EVENT
    ) as Observable<string>;
  }
}
