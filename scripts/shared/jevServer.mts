/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as FileSystem from 'effect/FileSystem';
import * as Path from 'effect/Path';
import * as Redacted from 'effect/Redacted';
import * as Schedule from 'effect/Schedule';
import * as ChildProcess from 'effect/process/ChildProcess';
import * as Config from 'effect/Config';
import * as Duration from 'effect/Duration';
import { randomBytes } from 'node:crypto';

/** Owns the isolated authenticated server for the duration of a child script. */
export const withJevServer = Effect.fn('jev.server')(function* (script: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const apiKey = yield* Config.Redacted('OPENCODE_API_KEY');
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: 'jev-opencode-' });
  const password = randomBytes(32).toString('hex');
  yield* Effect.sync(() => {
    console.log(`::add-mask::${password}`);
    console.log(`::add-mask::${Buffer.from(`opencode:${password}`).toString('base64')}`);
  });
  const environment = {
    ...Object.fromEntries(Object.keys(process.env).map(key => [key, ''])),
    PATH: process.env.PATH ?? '',
    HOME: directory,
    PWD: directory,
    XDG_CONFIG_HOME: path.join(directory, 'config'),
    XDG_DATA_HOME: path.join(directory, 'data'),
    XDG_STATE_HOME: path.join(directory, 'state'),
    XDG_CACHE_HOME: path.join(directory, 'cache'),
    OPENCODE_PASSWORD: password,
    OPENCODE_API_KEY: Redacted.value(apiKey),
    OPENCODE_CONFIG_CONTENT: JSON.stringify({
      providers: { opencode: { settings: { apiKey: '{env:OPENCODE_API_KEY}' } } }
    })
  };
  const server = yield* ChildProcess.make('opencode', ['serve', '--hostname', '127.0.0.1', '--port', '4096'], {
    cwd: directory,
    env: environment,
    stdout: 'inherit',
    stderr: 'inherit'
  });
  yield* Effect.addFinalizer(() => server.kill().pipe(Effect.orDie));
  yield* Effect.tryPromise(async signal => {
    const response = await fetch('http://127.0.0.1:4096/api/info', {
      signal,
      headers: { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}` }
    });
    if (!response.ok) throw new Error(`OpenCode readiness HTTP ${response.status}`);
  }).pipe(Effect.retry(Schedule.spaced(Duration.seconds(1))), Effect.timeout(Duration.seconds(60)));
  const scriptProcess = yield* ChildProcess.make('node', [script], {
    env: environment,
    stdout: 'inherit',
    stderr: 'inherit'
  });
  const exitCode = yield* scriptProcess.exitCode;
  if (exitCode !== 0) return yield* Effect.fail(new Error(`Jev script exited ${exitCode}`));
});
