/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';

export type ExecResult = { stdout: string; stderr: string };
export type ExecOptions = { timeout?: number; signal?: AbortSignal };

/** Thin injectable seam over node:child_process exec (promisified). Lets consumers (and tests) swap the
 * implementation via the Effect layer instead of mocking node:child_process, which keeps ts-jest on
 * isolatedModules:true for the whole package.
 * The node import stays lazy (inside exec, not at layer build) so this service is safe to construct on
 * web, where node:child_process is unavailable — callers guard the web case before invoking exec. */
export class ChildProcess extends Effect.Service<ChildProcess>()('ChildProcess', {
  accessors: false,
  effect: Effect.succeed({
    exec: async (command: string, options: ExecOptions): Promise<ExecResult> => {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      return promisify(exec)(command, options);
    }
  })
}) {}
