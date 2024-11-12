/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChildProcess } from 'child_process';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';

import { CancellationToken, CommandExecution } from '../types';
import { Command } from './command';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const treeKill = require('tree-kill');
export const NO_PID_ERROR = 'No process associated with sfdx command.';
export const NO_STDOUT_ERROR = 'No stdout found for childProcess';
export const NO_STDERR_ERROR = 'No stderr found for childProcess';
export const CANCELLATION_INTERVAL = 1000;
export const KILL_CODE = 'SIGKILL';

export class CliCommandExecution implements CommandExecution {
  public readonly command: Command;
  public readonly cancellationToken?: CancellationToken;
  public readonly processExitSubject: Observable<number | undefined>;
  public readonly processErrorSubject: Observable<Error | undefined>;
  public readonly stdoutSubject: Observable<Buffer | string>;
  public readonly stderrSubject: Observable<Buffer | string>;

  private readonly childProcessPid: number;

  constructor(command: Command, childProcess: ChildProcess, cancellationToken?: CancellationToken) {
    this.command = command;
    this.cancellationToken = cancellationToken;

    if (!childProcess.pid) {
      throw new Error(NO_PID_ERROR);
    }
    this.childProcessPid = childProcess.pid;

    let timerSubscriber: Subscription | null;

    // Process
    this.processExitSubject = Observable.fromEvent(childProcess, 'exit');
    this.processExitSubject.subscribe(() => {
      if (timerSubscriber) {
        timerSubscriber.unsubscribe();
      }
    });
    this.processErrorSubject = Observable.fromEvent(childProcess, 'error');
    this.processErrorSubject.subscribe(() => {
      if (timerSubscriber) {
        timerSubscriber.unsubscribe();
      }
    });

    // Output
    if (!childProcess.stdout) {
      throw new Error(NO_STDOUT_ERROR);
    }
    this.stdoutSubject = Observable.fromEvent(childProcess.stdout, 'data');
    if (!childProcess.stderr) {
      throw new Error(NO_STDERR_ERROR);
    }
    this.stderrSubject = Observable.fromEvent(childProcess.stderr, 'data');

    // Cancellation watcher
    if (cancellationToken) {
      const timer = Observable.interval(CANCELLATION_INTERVAL);
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

  public async killExecution(signal = KILL_CODE) {
    return killPromise(this.childProcessPid, signal);
  }
}

/**
 * This is required because of https://github.com/nodejs/node/issues/6052
 * Basically if a child process spawns it own children  processes, those
 * children (grandchildren) processes are not necessarily killed
 */
const killPromise = (processId: number, signal: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    treeKill(processId, signal, (err: Error | undefined) => {
      if (err) {
        reject(err);
      }
      resolve();
    });
  });
};
