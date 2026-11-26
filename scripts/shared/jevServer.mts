/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Command from '@effect/platform/Command';
import * as FileSystem from '@effect/platform/FileSystem';
import { Config, Duration, Effect, Redacted, Schedule } from 'effect';
import { randomBytes } from 'node:crypto';

/** Owns the isolated authenticated server for the duration of a child script. */
export const withJevServer = Effect.fn('jev.server')(function* (script: string) {
  const fs = yield* FileSystem.FileSystem;
  const apiKey = yield* Config.redacted('OPENCODE_API_KEY');
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: 'jev-opencode-' });
  const password = randomBytes(32).toString('hex');
  yield* Effect.sync(() => {
    console.log(`::add-mask::${password}`);
    console.log(`::add-mask::${Buffer.from(`opencode:${password}`).toString('base64')}`);
  });
  const environment = {
    OPENCODE_PASSWORD: password,
    OPENCODE_API_KEY: Redacted.value(apiKey),
    OPENCODE_CONFIG_CONTENT: JSON.stringify({
      providers: { opencode: { settings: { apiKey: '{env:OPENCODE_API_KEY}' } } }
    })
  };
  yield* Command.make('opencode', 'serve', '--hostname', '127.0.0.1', '--port', '4096').pipe(
    Command.workingDirectory(directory),
    Command.env(environment),
    Command.stdout('inherit'),
    Command.stderr('inherit'),
    Command.start
  );
  yield* Effect.tryPromise(async signal => {
    const response = await fetch('http://127.0.0.1:4096/api/info', {
      signal,
      headers: { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}` }
    });
    if (!response.ok) throw new Error(`OpenCode readiness HTTP ${response.status}`);
  }).pipe(Effect.retry(Schedule.spaced(Duration.seconds(1))), Effect.timeout(Duration.seconds(60)));
  const exitCode = yield* Command.make('node', script).pipe(
    Command.env(environment),
    Command.stdout('inherit'),
    Command.stderr('inherit'),
    Command.exitCode
  );
  if (exitCode !== 0) return yield* Effect.fail(new Error(`Jev script exited ${exitCode}`));
});
