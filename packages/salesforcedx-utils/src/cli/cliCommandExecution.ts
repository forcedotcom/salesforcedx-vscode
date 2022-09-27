import { ChildProcess } from 'child_process';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';

import * as kill from 'tree-kill';
import { CancellationToken, CommandExecution } from '../types';
import { Command } from './command';

export class CliCommandExecution implements CommandExecution {
  public readonly command: Command;
  public readonly cancellationToken?: CancellationToken;
  public readonly processExitSubject: Observable<number | undefined>;
  public readonly processErrorSubject: Observable<Error | undefined>;
  public readonly stdoutSubject: Observable<Buffer | string>;
  public readonly stderrSubject: Observable<Buffer | string>;

  private readonly childProcessPid: number;

  constructor(
    command: Command,
    childProcess: ChildProcess,
    cancellationToken?: CancellationToken
  ) {
    this.command = command;
    this.cancellationToken = cancellationToken;

    if (!childProcess.pid) {
      throw new Error('No process associated with sfdx command.');
    }
    this.childProcessPid = childProcess.pid;

    let timerSubscriber: Subscription | null;

    // Process
    this.processExitSubject = Observable.fromEvent(
      childProcess,
      'exit'
    ) as Observable<number | undefined>;
    this.processExitSubject.subscribe(() => {
      if (timerSubscriber) {
        timerSubscriber.unsubscribe();
      }
    });
    this.processErrorSubject = Observable.fromEvent(
      childProcess,
      'error'
    ) as Observable<Error | undefined>;
    this.processErrorSubject.subscribe(() => {
      if (timerSubscriber) {
        timerSubscriber.unsubscribe();
      }
    });

    // Output
    if (!childProcess.stdout) {
      throw new Error('No stdout found for childProcess');
    }
    this.stdoutSubject = Observable.fromEvent(childProcess.stdout, 'data');
    if (!childProcess.stderr) {
      throw new Error('No stderr found for childProcess');
    }
    this.stderrSubject = Observable.fromEvent(childProcess.stderr, 'data');

    // Cancellation watcher
    if (cancellationToken) {
      const timer = Observable.interval(1000);
      timerSubscriber = timer.subscribe(async () => {
        if (cancellationToken.isCancellationRequested) {
          try {
            await this.killExecution();
          } catch (e) {
            console.log(e);
          }
        }
      });
    }
  }

  public async killExecution(signal = 'SIGKILL') {
    return killPromise(this.childProcessPid, signal);
  }
}

/**
 * This is required because of https://github.com/nodejs/node/issues/6052
 * Basically if a child process spawns it own children  processes, those
 * children (grandchildren) processes are not necessarily killed
 */
async function killPromise(processId: number, signal: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    kill(processId, signal, (err: Error | undefined) => {
      err ? reject(err) : resolve();
    });
  });
}
