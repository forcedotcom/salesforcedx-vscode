/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ChildProcess, SpawnOptions } from 'child_process';
import * as cross_spawn from 'cross-spawn';
import * as os from 'os';
import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/observable/interval';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';

// tslint:disable-next-line:no-var-requires
const kill = require('tree-kill');

import { Command } from './';

export interface CancellationToken {
  isCancellationRequested: boolean;
}

export class GlobalCliEnvironment {
  public static readonly environmentVariables = new Map<string, string>();
}

export class CliCommandExecutor {
  protected static patchEnv(
    options: SpawnOptions,
    baseEnvironment: Map<string, string>
  ): SpawnOptions {
    // start with current process environment
    const env = Object.create(null);

    // inherit current process environment
    Object.assign(env, process.env);

    // now push anything from global environment
    baseEnvironment.forEach((value, key) => {
      env[key] = value;
    });

    // then specific environment from Spawn Options
    if (typeof options.env !== 'undefined') {
      Object.assign(env, options.env);
    }

    options.env = env;
    return options;
  }

  private readonly command: Command;
  private readonly options: SpawnOptions;

  public constructor(
    command: Command,
    options: SpawnOptions,
    inheritGlobalEnvironmentVariables = true
  ) {
    this.command = command;
    this.options = inheritGlobalEnvironmentVariables
      ? CliCommandExecutor.patchEnv(
          options,
          GlobalCliEnvironment.environmentVariables
        )
      : options;
  }

  public execute(cancellationToken?: CancellationToken): CommandExecution {
    const childProcess = cross_spawn(
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

  public constructor(commands: Command) {
    this.command = commands;
  }

  public execute(
    cancellationToken?: CancellationToken
  ): CompositeCliCommandExecution {
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
  public readonly stdoutSubject: Observable<string>;
  public readonly stderrSubject: Observable<string>;
  private readonly exitSubject: Subject<number | undefined>;
  private readonly errorSubject: Subject<Error | undefined>;
  private readonly stdout: Subject<string>;
  private readonly stderr: Subject<string>;

  constructor(command: Command, cancellationToken?: CancellationToken) {
    this.exitSubject = new Subject();
    this.errorSubject = new Subject();
    this.stdout = new Subject();
    this.stderr = new Subject();
    this.command = command;
    this.cancellationToken = cancellationToken;
    this.processExitSubject = this.exitSubject.asObservable();
    this.processErrorSubject = this.errorSubject.asObservable();
    this.stdoutSubject = this.stdout.asObservable();
    this.stderrSubject = this.stderr.asObservable();

    let timerSubscriber: Subscription | null;
    if (cancellationToken) {
      const timer = Observable.interval(1000);
      timerSubscriber = timer.subscribe(async next => {
        if (cancellationToken.isCancellationRequested) {
          try {
            this.exitSubject.next();
          } catch (e) {
            console.log(e);
          }
        }
      });
    }
    this.processErrorSubject.subscribe(next => {
      if (timerSubscriber) {
        timerSubscriber.unsubscribe();
      }
    });

    this.processExitSubject.subscribe(next => {
      if (timerSubscriber) {
        timerSubscriber.unsubscribe();
      }
    });
  }

  public successfulExit() {
    this.exitSubject.next(0);
  }

  public failureExit(e?: {}) {
    if (e) {
      this.stderr.next(`${e}${os.EOL}`);
    }
    this.exitSubject.next(1);
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
    kill(processId, 'SIGKILL', (err: {}) => {
      err ? reject(err) : resolve();
    });
  });
}
