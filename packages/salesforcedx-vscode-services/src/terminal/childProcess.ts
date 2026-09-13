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
 * can blow past 1MB, so raise the cap well above any realistic CLI payload. Enforced by hand here because
 * `maxBuffer` is an exec/execFile option, not a spawn option. */
const MAX_BUFFER = 100 * 1024 * 1024;

type SpawnOptions = { timeout?: number; env?: NodeJS.ProcessEnv; cwd?: string };

/** Resolve node spawn options from our ExecOptions. With an `env` override, spread `process.env` under it so
 * PATH survives (node only inherits the parent env when `env` is omitted entirely); without one, omit `env`
 * so node inherits the full parent env. `cwd`/`timeout` are threaded through only when set. `signal` is dropped
 * here on purpose — the buffered wrapper owns abort handling manually so an interrupt isn't misclassified as a
 * timeout by spawn's own kill path. Pure fn so the merge is unit-testable without spawning. NOTE: `maxBuffer`
 * is intentionally NOT here — it is not a spawn option; the buffered wrapper enforces it manually. */
export const resolveSpawnOptions = (options: ExecOptions): SpawnOptions => {
  const { env, signal: _signal, ...rest } = options;
  return env ? { ...rest, env: { ...process.env, ...env } } : { ...rest };
};

/** Rejection shape matching node's ExecException fields that TerminalService.execFailure inspects
 * (`code`/`signal`/`killed`/`stdout`/`stderr`). Rebuilt by hand because we no longer go through exec. */
type SpawnFailure = Error & {
  code?: number | string;
  signal?: string;
  killed?: boolean;
  stdout: string;
  stderr: string;
};

const spawnFailure = (
  message: string,
  fields: { code?: number | string; signal?: string; killed?: boolean; stdout: string; stderr: string }
): SpawnFailure => Object.assign(new Error(message), fields);

/**
 * Thin injectable seam over a SHELL-FREE process spawn (buffered, promisified). The executable and its
 * arguments are passed SEPARATELY and never concatenated into a shell string, so no argument — including a
 * workspace-controlled file path — can be interpreted as shell syntax (command substitution, redirection,
 * chaining). This is the injection-safe boundary the org-create PVR (W-24161260) requires.
 *
 * Uses `cross-spawn` (same dependency the apex-debugger CliCommandExecutor uses) rather than node's
 * `execFile`/`spawn` directly: on Windows `sf` resolves to `sf.cmd`, which node refuses to spawn without a
 * shell since the CVE-2024-27980 fix (EINVAL); cross-spawn resolves the shim and escapes args for cmd.exe
 * without re-enabling shell interpretation of the caller's arguments.
 *
 * Consumers/tests swap the impl via the Effect layer instead of mocking node:child_process. The node/cross-spawn
 * imports stay lazy (inside exec) so the service is safe to construct on web; callers guard the web case first.
 */
export class ChildProcess extends Effect.Service<ChildProcess>()('ChildProcess', {
  accessors: false,
  effect: Effect.succeed({
    exec: async (executable: string, args: readonly string[], options: ExecOptions): Promise<ExecResult> => {
      const spawn = (await import('cross-spawn')).default;
      const spawnOptions = resolveSpawnOptions(options);

      return new Promise<ExecResult>((resolve, reject) => {
        // stdio: inherit nothing on stdin; pipe stdout/stderr so we can buffer them. shell is never enabled.
        const child = spawn(executable, [...args], { ...spawnOptions, stdio: ['ignore', 'pipe', 'pipe'] });

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        // eslint-disable-next-line functional/no-let -- running byte count accumulated across stream 'data' events
        let stdoutBytes = 0;
        // eslint-disable-next-line functional/no-let -- one-shot latch so the first of abort/error/close/maxBuffer wins
        let settled = false;
        const stdout = (): string => Buffer.concat(stdoutChunks).toString('utf8');
        const stderr = (): string => Buffer.concat(stderrChunks).toString('utf8');

        // abort → reject as ABORT_ERR (execFailure maps this to 'cancelled', preserving fiber-interrupt
        // semantics). Handled explicitly rather than via spawn's `signal` option so an abort is not
        // misclassified as a timeout by the killed/signal close path below.
        const onAbort = (): void => {
          if (settled) return;
          settled = true;
          child.kill('SIGTERM');
          reject(spawnFailure('The operation was aborted', { code: 'ABORT_ERR', stdout: stdout(), stderr: stderr() }));
        };
        if (options.signal) {
          if (options.signal.aborted) {
            onAbort();
            return;
          }
          options.signal.addEventListener('abort', onAbort, { once: true });
        }
        const cleanup = (): void => options.signal?.removeEventListener('abort', onAbort);

        child.stdout?.on('data', (chunk: Buffer) => {
          stdoutBytes += chunk.length;
          if (stdoutBytes > MAX_BUFFER) {
            if (settled) return;
            settled = true;
            cleanup();
            child.kill('SIGTERM');
            reject(
              spawnFailure('stdout maxBuffer length exceeded', {
                code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
                stdout: stdout(),
                stderr: stderr()
              })
            );
            return;
          }
          stdoutChunks.push(chunk);
        });
        child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

        // spawn failure (e.g. ENOENT: executable not on PATH). node sets a string `code`; execFailure maps it
        // to 'spawn_error'.
        child.on('error', (err: NodeJS.ErrnoException) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(Object.assign(err, { stdout: stdout(), stderr: stderr() }));
        });

        // normal termination. code===0 resolves; a non-zero exit or a signal kill (timeout → killed=true,
        // signal='SIGTERM') rejects with the fields execFailure classifies.
        child.on('close', (code: number | null, signal: string | null) => {
          if (settled) return;
          settled = true;
          cleanup();
          if (code === 0) {
            resolve({ stdout: stdout(), stderr: stderr() });
            return;
          }
          reject(
            spawnFailure(`Command failed${code === null ? '' : ` with exit code ${code}`}`, {
              ...(typeof code === 'number' ? { code } : {}),
              ...(signal ? { signal } : {}),
              killed: child.killed,
              stdout: stdout(),
              stderr: stderr()
            })
          );
        });
      });
    }
  })
}) {}
