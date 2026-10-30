/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ApexExecuteOptions, ExecuteAnonymousResponse } from './types';
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Result from 'effect/Result';
import { existsSync, readFileSync } from 'node:fs';
import { EOL } from 'node:os';
import * as readline from 'node:readline';
import { executeAnonymous } from '../effect';
import { nls } from '../i18n';
import { elapsedTime } from '../utils/elapsedTime';

/** Promise adapter for CLI consumers; the Effect API owns execution and diagnostics. */
export class ExecuteService {
  constructor(private readonly connection: Connection) {}

  @elapsedTime()
  public async executeAnonymous(options: ApexExecuteOptions): Promise<ExecuteAnonymousResponse> {
    const apexCode = await this.getApexCode(options);
    const execution = await executeAnonymous(this.connection, { apexCode }).pipe(Effect.result, Effect.runPromise);
    // Unwrap typed failures outside the Effect runtime so CLI errors do not acquire a FiberFailure prefix.
    if (Result.isFailure(execution)) {
      const error = execution.failure;
      switch (error._tag) {
        case 'ApexCompileError':
          return {
            compiled: false,
            success: false,
            logs: error.logBody,
            diagnostic: [
              {
                lineNumber: error.line,
                columnNumber: error.column,
                compileProblem: error.compileProblem ?? '',
                exceptionMessage: '',
                exceptionStackTrace: ''
              }
            ]
          };
        case 'ApexRuntimeError':
          return {
            compiled: true,
            success: false,
            logs: error.logBody,
            diagnostic: [
              {
                lineNumber: error.line,
                columnNumber: error.column,
                compileProblem: '',
                exceptionMessage: error.exceptionMessage ?? '',
                exceptionStackTrace: error.exceptionStackTrace ?? ''
              }
            ]
          };
        default:
          throw new Error(error.message);
      }
    }
    const result = execution.success;
    return {
      compiled: result.compiled,
      success: result.success,
      logs: result.logBody
    };
  }

  // Keep the CLI input contract until plugin-apex reads files/stdin itself.
  @elapsedTime()
  private async getApexCode(options: ApexExecuteOptions): Promise<string> {
    if (options.apexCode !== undefined) return options.apexCode.toString();
    if (options.apexFilePath) return this.readApexFile(options.apexFilePath);
    if (options.userInput) return this.getUserInput();
    throw new Error(nls.localize('optionExecAnonError'));
  }

  @elapsedTime()
  private readApexFile(filepath: string): string {
    if (!existsSync(filepath)) throw new Error(nls.localize('fileNotFoundError', filepath));
    return readFileSync(filepath, 'utf8');
  }

  @elapsedTime()
  private async getUserInput(): Promise<string> {
    process.stdout.write(nls.localize('execAnonInputPrompt'));
    return new Promise<string>((resolve, reject) => {
      const readInterface = readline.createInterface(process.stdin, process.stdout);
      const timeout = setTimeout(() => {
        reject(new Error(nls.localize('execAnonInputTimeout')));
        readInterface.close();
      }, 60_000);

      let apexCode = '';
      readInterface.on('line', (input: string) => {
        timeout.refresh();
        apexCode += input + EOL;
      });
      readInterface.on('close', () => {
        resolve(apexCode);
        clearTimeout(timeout);
      });
      readInterface.on('error', (err: Error) => {
        reject(new Error(nls.localize('unexpectedExecAnonInputError', err.message)));
        readInterface.close();
      });
    });
  }
}
