/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CancellationToken, Command } from '@salesforce/salesforcedx-utils';
import { Observable } from 'rxjs/Observable';

/**
 * Represents a command execution (a process has already been spawned for it).
 * This is tightly coupled with the execution model (child_process).
 * If we ever use a different executor, this class should be refactored and abstracted
 * to take an event emitter/observable instead of child_proces.
 */
export type CommandExecution = {
  readonly command: Command;
  readonly cancellationToken?: CancellationToken;
  readonly processExitSubject: Observable<number | undefined>;
  readonly processErrorSubject: Observable<Error | undefined>;
  readonly stdoutSubject: Observable<Buffer | string>;
  readonly stderrSubject: Observable<Buffer | string>;
};
