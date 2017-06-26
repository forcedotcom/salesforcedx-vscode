import { Command } from './';
import { spawn, ChildProcess, ExecOptions } from 'child_process';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/observable/interval';

export interface CancellationToken {
  isCancellationRequested: boolean;
}

export class CliCommandExecutor {
  private readonly command: Command;
  private readonly options: ExecOptions;

  public constructor(command: Command, options: ExecOptions) {
    this.command = command;
    this.options = options;
  }

  public execute(cancellationToken?: CancellationToken): CommandExecution {
    const childProcess = spawn(
      this.command.command,
      this.command.args,
      this.options
    );
    return new CommandExecution(childProcess, cancellationToken);
  }
}

export class CommandExecution {
  public readonly processExitSubject: Observable<number | string>;
  public readonly stdoutSubject: Observable<Buffer | string>;
  public readonly stderrSubject: Observable<Buffer | string>;

  constructor(
    childProcess: ChildProcess,
    cancellationToken?: CancellationToken
  ) {
    let timerSubscriber: Subscription | null;

    // Process
    this.processExitSubject = Observable.fromEvent(childProcess, 'exit');
    this.processExitSubject.subscribe(next => {
      if (timerSubscriber) {
        timerSubscriber.unsubscribe();
      }
    });

    // Output
    this.stdoutSubject = Observable.fromEvent(childProcess.stdout, 'data');
    this.stderrSubject = Observable.fromEvent(childProcess.stderr, 'data');

    // Cancellation watcher
    if (cancellationToken) {
      const timer = Observable.interval(1000);
      timerSubscriber = timer.subscribe(next => {
        if (cancellationToken.isCancellationRequested) {
          childProcess.kill();
        }
      });
    }
  }
}
