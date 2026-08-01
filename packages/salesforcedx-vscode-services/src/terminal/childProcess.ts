/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';

export type ExecResult = { stdout: string; stderr: string };
export type ExecOptions = { timeout?: number; signal?: AbortSignal; env?: Record<string, string>; cwd?: string };

/** node's `exec` defaults `maxBuffer` to 1MB and rejects with ERR_CHILD_PROCESS_STDIO_MAXBUFFER once stdout
 * exceeds it. sf commands that stream large human-readable output (e.g. `project retrieve start` on a large org)
 * can blow past 1MB, so raise the cap well above any realistic CLI payload. */
const MAX_BUFFER = 100 * 1024 * 1024;

/** Resolve node exec options from our ExecOptions. With an `env` override, spread `process.env` under it so
 * PATH survives (node only inherits the parent env when `env` is omitted entirely); without one, omit `env`
 * so node inherits the full parent env. `cwd` is threaded through only when set (else node uses process.cwd()).
 * `maxBuffer` is always set so large stdout doesn't reject. Pure fn so the merge is unit-testable without the
 * lazy node import. */
export const resolveExecOptions = (
  options: ExecOptions
): { timeout?: number; signal?: AbortSignal; env?: NodeJS.ProcessEnv; cwd?: string; maxBuffer: number } => {
  const { env, ...rest } = options;
  return env ? { ...rest, maxBuffer: MAX_BUFFER, env: { ...process.env, ...env } } : { ...rest, maxBuffer: MAX_BUFFER };
};

/** Thin injectable seam over node:child_process exec (promisified). Consumers/tests swap the impl via the
 * Effect layer instead of mocking node:child_process (keeps ts-jest on isolatedModules:true). The node import
 * stays lazy (inside exec) so the service is safe to construct on web; callers guard the web case first. */
export class ChildProcess extends Effect.Service<ChildProcess>()('ChildProcess', {
  accessors: false,
  effect: Effect.succeed({
    exec: async (command: string, options: ExecOptions): Promise<ExecResult> => {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      return promisify(exec)(command, resolveExecOptions(options));
    },
    execFile: async (file: string, args: string[], options: ExecOptions): Promise<ExecResult> => {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      return promisify(execFile)(file, args, resolveExecOptions(options));
    }
  })
}) {}
