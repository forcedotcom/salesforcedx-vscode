/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ChildProcess, ExecOptions, spawn } from 'child_process';
import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/observable/interval';
import { Observable } from 'rxjs/Observable';
import { EmptyObservable } from 'rxjs/observable/EmptyObservable';
import { Subscription } from 'rxjs/Subscription';

// tslint:disable-next-line:no-var-requires
const kill = require('tree-kill');

import { Command } from './';

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
    return new CliCommandExecution(
      this.command,
      childProcess,
      cancellationToken
    );
  }
}

export class CompositeCliCommandExecutor {
  private readonly command: Command;
  private readonly options: ExecOptions;

  public constructor(commands: Command, options: ExecOptions) {
    this.command = commands;
    this.options = options;
  }

  public execute(cancellationToken?: CancellationToken): CommandExecution {
    return new CompositeCliCommandExecution(this.command, cancellationToken);
  }
}

/**
 * Represents a command execution (a process has already been spawned for it).
 * This is tightly coupled with the execution model (child_process).
 * If we ever use a different executor, this class should be refactored and abstracted
 * to take an event emitter/observable instead of child_proces.
 */
export interface CommandExecution {
  readonly command: Command;
  readonly cancellationToken?: CancellationToken;
  readonly processExitSubject: Observable<number | undefined>;
  readonly processErrorSubject: Observable<Error | undefined>;
  readonly stdoutSubject: Observable<Buffer | string>;
  readonly stderrSubject: Observable<Buffer | string>;
}

export class CompositeCliCommandExecution implements CommandExecution {
  public readonly command: Command;
  public readonly cancellationToken?: CancellationToken;
  public readonly processExitSubject: Observable<number | undefined>;
  public readonly processErrorSubject: Observable<Error | undefined>;
  public readonly stdoutSubject: Observable<Buffer | string>;
  public readonly stderrSubject: Observable<Buffer | string>;

  constructor(command: Command, cancellationToken?: CancellationToken) {
    this.command = command;
    this.cancellationToken = cancellationToken;
    this.processExitSubject = EmptyObservable.create();
    this.processErrorSubject = EmptyObservable.create();
    this.stdoutSubject = EmptyObservable.create();
    this.stderrSubject = EmptyObservable.create();
  }
}

export class CliCommandExecution implements CommandExecution {
  public readonly command: Command;
  public readonly cancellationToken?: CancellationToken;
  public readonly processExitSubject: Observable<number | undefined>;
  public readonly processErrorSubject: Observable<Error | undefined>;
  public readonly stdoutSubject: Observable<Buffer | string>;
  public readonly stderrSubject: Observable<Buffer | string>;

  constructor(
    command: Command,
    childProcess: ChildProcess,
    cancellationToken?: CancellationToken
  ) {
    this.command = command;
    this.cancellationToken = cancellationToken;

    let timerSubscriber: Subscription | null;

    // Process
    this.processExitSubject = Observable.fromEvent(
      childProcess,
      'exit'
    ) as Observable<number | undefined>;
    this.processExitSubject.subscribe(next => {
      if (timerSubscriber) {
        timerSubscriber.unsubscribe();
      }
    });
    this.processErrorSubject = Observable.fromEvent(
      childProcess,
      'error'
    ) as Observable<Error | undefined>;
    this.processErrorSubject.subscribe(next => {
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
      timerSubscriber = timer.subscribe(async next => {
        if (cancellationToken.isCancellationRequested) {
          try {
            await killPromise(childProcess.pid);
          } catch (e) {
            console.log(e);
          }
        }
      });
    }
  }
}

/**
 * This is required because of https://github.com/nodejs/node/issues/6052
 * Basically if a child process spawns it own children  processes, those
 * children (grandchildren) processes are not necessarily killed
 */
async function killPromise(processId: number) {
  return new Promise((resolve, reject) => {
    kill(processId, 'SIGKILL', (err: any) => {
      err ? reject(err) : resolve();
    });
  });
}
