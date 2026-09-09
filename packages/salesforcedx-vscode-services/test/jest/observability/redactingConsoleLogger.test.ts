/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import type { SpiedFunction } from 'jest-mock';
import { redactingConsoleLoggerLayer } from '../../../src/observability/redactingConsoleLogger';

describe('redactingConsoleLogger', () => {
  const runLog = (log: Effect.Effect<void>): void =>
    Effect.runSync(log.pipe(Effect.provide(redactingConsoleLoggerLayer)));

  let consoleLog: SpiedFunction<typeof console.log>;

  beforeEach(() => {
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleLog.mockRestore();
  });

  it('redacts secrets from messages, causes, and annotations before writing to the console', () => {
    runLog(
      Effect.logError(
        'request used 00D000000000000!message-secret',
        Cause.fail('response contained eyJheader.eyJpayload.cause-secret')
      ).pipe(Effect.annotateLogs({ cookie: 'sid=annotation-secret' }))
    );

    expect(consoleLog).toHaveBeenCalledTimes(1);
    const output = String(consoleLog.mock.calls[0][0]);
    expect(output).not.toContain('message-secret');
    expect(output).not.toContain('cause-secret');
    expect(output).not.toContain('annotation-secret');
    expect(output).toContain('<REDACTED ACCESS TOKEN>');
    expect(output).toContain('<REDACTED JWT TOKEN>');
    expect(output).toContain('<REDACTED SID>');
  });

  it('preserves the default logger metadata and non-sensitive content', () => {
    runLog(Effect.logInfo('deployment completed').pipe(Effect.annotateLogs({ componentCount: 3 })));

    expect(consoleLog).toHaveBeenCalledTimes(1);
    const output = String(consoleLog.mock.calls[0][0]);
    expect(output).toContain('timestamp=');
    expect(output).toContain('level=INFO');
    expect(output).toContain('fiber=');
    expect(output).toContain('message="deployment completed"');
    expect(output).toContain('componentCount=3');
  });
});
