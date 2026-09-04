/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * The command-runner seam. Every container-facing utility shells out through this instead of calling
 * execFileSync directly, so unit tests inject a fake that records argv (asserting the exact
 * `docker cp …` a utility builds) with no real docker. The default is the real execFileSync, using
 * arg arrays — never a shell string — so no argument is shell-interpreted (#7718 idiom).
 *
 * Plain function, not an Effect service: a team not on Effect can still use every utility. This repo
 * may wrap it as a layer, but the seam itself imposes no Effect dependency.
 */

import { execFileSync } from 'node:child_process';

/** Runs a command with an argv array and returns stdout as a string. Throws on non-zero exit. */
export type CommandRunner = (file: string, args: readonly string[]) => string;

// A bare execFileSync blocks FOREVER if the child never returns — a hung docker daemon or a wedged
// container would deadlock the whole run with no way to abort. So every shelled command is given a
// per-attempt timeout and retried on TIMEOUT only; the timeout is the hang backstop, the retry
// rides out a transient wedge. Defaults are generous + env-overridable so a legitimately slow op
// (a multi-GB `docker pull`) is not killed mid-progress, and tests can dial them down.
const DEFAULT_TIMEOUT_MS = 600_000; // 10 min per attempt
const DEFAULT_MAX_ATTEMPTS = 5;

/** Per-attempt timeout (ms) for a shelled command. Env-overridable via CB_RUNNER_TIMEOUT_MS. */
export const runnerTimeoutMs = (): number => {
  const raw = process.env.CB_RUNNER_TIMEOUT_MS;
  if (raw === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }
  // `0` is a VALID explicit "no timeout" (execFileSync treats 0/undefined as unbounded), so honor it
  // rather than `|| DEFAULT`-ing it back to 10 min. Only an unset/NaN/negative value falls back.
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TIMEOUT_MS;
};

// execFileSync throws `code: 'ETIMEDOUT'` when its `timeout` fires (it SIGTERMs the child); a genuine
// non-zero exit has a numeric `status` and no such code. Only the former is a hang worth retrying.
const isTimeout = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && 'code' in err && err.code === 'ETIMEDOUT';

/*
 * Run `attempt`, retrying ONLY on timeout up to CB_RUNNER_MAX_ATTEMPTS times, then bubble the last
 * timeout error. A non-timeout failure (a real non-zero exit) is thrown immediately — retrying a
 * command that legitimately failed would just repeat the failure. Shared with swap's host-side
 * extractor so extraction gets the same hang protection.
 */
export const withTimeoutRetry = <T>(attempt: () => T): T => {
  // Always run at least once, even if the env var is 0/negative/garbage — otherwise the loop would
  // be skipped and we'd fall through to `throw lastError` with nothing set.
  const maxAttempts = Math.max(1, Number(process.env.CB_RUNNER_MAX_ATTEMPTS) || DEFAULT_MAX_ATTEMPTS);
  let lastError: unknown;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      return attempt();
    } catch (err) {
      if (!isTimeout(err)) {
        throw err; // real failure, not a hang — do not retry
      }
      lastError = err;
    }
  }
  // maxAttempts >= 1 guarantees lastError is set here; the ?? guard just makes `throw undefined`
  // impossible if that ever changes.
  throw lastError ?? new Error('withTimeoutRetry: exhausted with no attempt executed');
};

/** Default runner: real process execution, arg-array form (no shell interpolation), with timeout + retry. */
export const defaultRunner: CommandRunner = (file, args) =>
  withTimeoutRetry(() => execFileSync(file, args as string[], { encoding: 'utf-8', timeout: runnerTimeoutMs() }));

/*
 * Shared charset guard for every value that gets interpolated into a `bash -c` string — a publisher
 * prefix, a package.json name/version, an extension id. These are the ONLY places a shelled command
 * is built from a string rather than an argv array, so a stray shell/glob metacharacter (`;`, `$`,
 * backtick, `*`, `?`, `[`, whitespace) would otherwise be interpreted by the shell or silently widen
 * a glob. Only npm-style chars are legitimate. Also reject a value that is only dots (`.`/`..`): a
 * `.`-prefix would make a wipe glob like `${value}.*` reach the parent dir, so require at least one
 * alphanumeric so `..`, `.`, `--`, etc. can't slip through. swap and verify BOTH call this so their
 * injection defenses can never diverge. Returns the validated value so callers can use it inline.
 */
const VALID_SHELL_SEGMENT = /^[A-Za-z0-9._-]+$/;
export const assertSafeShellSegment = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`missing or non-string ${label} (got ${JSON.stringify(value)})`);
  }
  if (!VALID_SHELL_SEGMENT.test(value) || !/[A-Za-z0-9]/.test(value)) {
    throw new Error(`unsafe ${label} ${JSON.stringify(value)}: expected only [A-Za-z0-9._-] with an alphanumeric`);
  }
  return value;
};
