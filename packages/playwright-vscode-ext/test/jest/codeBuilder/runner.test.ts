/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { defaultRunner, runnerTimeoutMs, withTimeoutRetry } from '../../../src/codeBuilder/runner';

const timeoutError = (): Error => Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' });

describe('runnerTimeoutMs', () => {
  const saved = process.env.CB_RUNNER_TIMEOUT_MS;
  afterEach(() => {
    if (saved === undefined) {
      delete process.env.CB_RUNNER_TIMEOUT_MS;
    } else {
      process.env.CB_RUNNER_TIMEOUT_MS = saved;
    }
  });

  it('defaults to a generous 10 minutes so a slow docker pull is not killed mid-progress', () => {
    delete process.env.CB_RUNNER_TIMEOUT_MS;
    expect(runnerTimeoutMs()).toBe(600_000);
  });

  it('honors CB_RUNNER_TIMEOUT_MS', () => {
    process.env.CB_RUNNER_TIMEOUT_MS = '1234';
    expect(runnerTimeoutMs()).toBe(1234);
  });
});

describe('withTimeoutRetry', () => {
  const savedAttempts = process.env.CB_RUNNER_MAX_ATTEMPTS;
  afterEach(() => {
    if (savedAttempts === undefined) {
      delete process.env.CB_RUNNER_MAX_ATTEMPTS;
    } else {
      process.env.CB_RUNNER_MAX_ATTEMPTS = savedAttempts;
    }
  });

  it('returns the value on first success, no retry', () => {
    let calls = 0;
    const out = withTimeoutRetry(() => {
      calls++;
      return 'ok';
    });
    expect(out).toBe('ok');
    expect(calls).toBe(1);
  });

  it('retries ONLY on ETIMEDOUT, up to CB_RUNNER_MAX_ATTEMPTS, then bubbles the timeout', () => {
    process.env.CB_RUNNER_MAX_ATTEMPTS = '3';
    let calls = 0;
    expect(() =>
      withTimeoutRetry(() => {
        calls++;
        throw timeoutError();
      })
    ).toThrow('timed out');
    expect(calls).toBe(3);
  });

  it('does NOT retry a non-timeout failure (real non-zero exit) — throws immediately', () => {
    process.env.CB_RUNNER_MAX_ATTEMPTS = '5';
    let calls = 0;
    expect(() =>
      withTimeoutRetry(() => {
        calls++;
        throw new Error('command exited 1');
      })
    ).toThrow('command exited 1');
    expect(calls).toBe(1);
  });

  it('recovers if a later attempt succeeds after a transient timeout', () => {
    process.env.CB_RUNNER_MAX_ATTEMPTS = '3';
    let calls = 0;
    const out = withTimeoutRetry(() => {
      calls++;
      if (calls < 2) {
        throw timeoutError();
      }
      return 'recovered';
    });
    expect(out).toBe('recovered');
    expect(calls).toBe(2);
  });
});

describe('defaultRunner', () => {
  const savedTimeout = process.env.CB_RUNNER_TIMEOUT_MS;
  const savedAttempts = process.env.CB_RUNNER_MAX_ATTEMPTS;
  const restore = (key: string, saved: string | undefined): void => {
    if (saved === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved;
    }
  };
  afterEach(() => {
    restore('CB_RUNNER_TIMEOUT_MS', savedTimeout);
    restore('CB_RUNNER_MAX_ATTEMPTS', savedAttempts);
  });

  it('returns stdout for a normal command', () => {
    expect(defaultRunner('echo', ['hello']).trim()).toBe('hello');
  });

  it('times out a hanging command and bubbles after the retries are exhausted', () => {
    process.env.CB_RUNNER_TIMEOUT_MS = '150';
    process.env.CB_RUNNER_MAX_ATTEMPTS = '2';
    expect(() => defaultRunner('sleep', ['5'])).toThrow();
  }, 10_000);
});
