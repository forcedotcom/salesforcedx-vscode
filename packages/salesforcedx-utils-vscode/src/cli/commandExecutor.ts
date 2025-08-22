/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Command, GlobalCliEnvironment, CancellationToken } from '@salesforce/salesforcedx-utils';
import { ChildProcess, SpawnOptions } from 'node:child_process';
import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/observable/interval';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';

// Below two dependencies are not structured correctly for import unless require is used.
/* eslint-disable @typescript-eslint/no-var-requires */
const cross_spawn = require('cross-spawn');
const kill = require('tree-kill');
/* eslint-enable @typescript-eslint/no-var-requires */

export class CliCommandExecutor {
  protected static patchEnv(options: SpawnOptions, baseEnvironment: Map<string, string>): SpawnOptions {
    // start with current process environment
    const env = Object.create(null);

    // inherit current process environment
    Object.assign(env, process.env);

    // now push anything from global environment
    baseEnvironment.forEach((value, key) => {
      env[key] = value;
    });

    // telemetry header
    if (env) {
      env.SFDX_TOOL = 'salesforce-vscode-extensions';
    }

    // then specific environment from Spawn Options
    if (options.env !== undefined) {
      Object.assign(env, options.env);
    }

    options.env = env;
    return options;
  }

  private readonly command: Command;
  private readonly options: SpawnOptions;

  constructor(command: Command, options: SpawnOptions, inheritGlobalEnvironmentVariables = true) {
    this.command = command;
    this.options = inheritGlobalEnvironmentVariables
      ? CliCommandExecutor.patchEnv(options, GlobalCliEnvironment.environmentVariables)
      : options;
  }

  public execute(cancellationToken?: CancellationToken): CliCommandExecution {
    const childProcess = cross_spawn(this.command.command, this.command.args, this.options);
    return new CliCommandExecution(this.command, childProcess, cancellationToken);
  }
}

/**
 * Represents a command execution (a process has already been spawned for it).
 * This is tightly coupled with the execution model (child_process).
 * If we ever use a different executor, this class should be refactored and abstracted
 * to take an event emitter/observable instead of child_process.
 */
export type CommandExecution = {
  readonly command: Command;
  readonly cancellationToken?: CancellationToken;
  readonly processExitSubject: Observable<number | undefined>;
  readonly processErrorSubject: Observable<Error | undefined>;
  readonly stdoutSubject: Observable<Buffer | string>;
  readonly stderrSubject: Observable<Buffer | string>;
};

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

    if (childProcess.pid === undefined) {
      // TODO: Gordon should we throw here or what?
      throw new Error('CLI Command process failed to start');
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
    this.stdoutSubject = Observable.fromEvent(childProcess.stdout!, 'data');
    this.stderrSubject = Observable.fromEvent(childProcess.stderr!, 'data');

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

  public async killExecution(signal: string = 'SIGKILL') {
    return killPromise(this.childProcessPid, signal);
  }
}

/**
 * This is required because of https://github.com/nodejs/node/issues/6052
 * Basically if a child process spawns it own children  processes, those
 * children (grandchildren) processes are not necessarily killed
 */
const killPromise = (processId: number, signal: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    kill(processId, signal, (err: {}) => {
      if (err) {
        reject(err);
      }
      resolve();
    });
  });
