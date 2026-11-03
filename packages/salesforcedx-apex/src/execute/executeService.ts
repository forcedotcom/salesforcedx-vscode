/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ApexExecuteOptions, ExecuteAnonymousResponse } from './types';
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import { executeAnonymous } from '../effect';
import { elapsedTime } from '../utils/elapsedTime';

/** Promise adapter for CLI consumers; the Effect API owns execution and diagnostics. */
export class ExecuteService {
  constructor(private readonly connection: Connection) {}

  @elapsedTime()
  public async executeAnonymous(options: ApexExecuteOptions): Promise<ExecuteAnonymousResponse> {
    const execution = await executeAnonymous(this.connection, options).pipe(Effect.either, Effect.runPromise);
    // Unwrap typed failures outside the Effect runtime so CLI errors do not acquire a FiberFailure prefix.
    if (Either.isLeft(execution)) {
      const error = execution.left;
      switch (error._tag) {
        case 'ApexCompileError':
          return {
            compiled: false,
            success: false,
            ...(error.logBody === undefined ? {} : { logs: error.logBody }),
            diagnostic: [
              {
                ...(error.line === undefined ? {} : { lineNumber: error.line }),
                ...(error.column === undefined ? {} : { columnNumber: error.column }),
                ...(error.compileProblem ? { compileProblem: error.compileProblem } : {})
              }
            ]
          };
        case 'ApexRuntimeError':
          return {
            compiled: true,
            success: false,
            ...(error.logBody === undefined ? {} : { logs: error.logBody }),
            diagnostic: [
              {
                ...(error.line === undefined ? {} : { lineNumber: error.line }),
                ...(error.column === undefined ? {} : { columnNumber: error.column }),
                ...(error.exceptionMessage ? { exceptionMessage: error.exceptionMessage } : {}),
                ...(error.exceptionStackTrace ? { exceptionStackTrace: error.exceptionStackTrace } : {})
              }
            ]
          };
        default:
          throw new Error(error.message);
      }
    }
    const result = execution.right;
    return {
      compiled: result.compiled,
      success: result.success,
      ...(result.logBody === undefined ? {} : { logs: result.logBody })
    };
  }
}
