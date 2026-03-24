/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { open } from '@vscode/test-web';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as path from 'node:path';
import { resolveRepoRoot } from '../utils/repoRoot';

type HeadlessServerOptions = {
  /** Extension name for logging (e.g., "Org Browser", "Metadata") */
  extensionName: string;
  /** The __dirname from the calling headlessServer.ts file (used to resolve extension paths) */
  callerDirname: string;
  /** Additional extension directory names to load (services is always included automatically) */
  additionalExtensionDirs?: string[];
};

/** Creates and starts a headless VS Code web server for testing an extension with services */
export const createHeadlessServer = async (options: HeadlessServerOptions): Promise<void> => {
  // callerDirname is '<pkg>/out/test/playwright/web' -> go up four levels to '<pkg>'
  const extensionDevelopmentPath = path.resolve(options.callerDirname, '..', '..', '..', '..');

  // Collect all extension paths: services + any additional
  const extensionPaths = (options.additionalExtensionDirs ?? [])
    .concat(['salesforcedx-vscode-services'])
    .map(dir => path.resolve(extensionDevelopmentPath, '..', dir));

  const repoRoot = resolveRepoRoot(options.callerDirname);
  const testRunnerDataDir = path.join(repoRoot, '.vscode-test-web');

  const openTask = Effect.fn('openHeadlessServer')(function* () {
    yield* Effect.log(`🌐 Starting VS Code Web (headless) for ${options.extensionName} tests...`, {
      extensionDevelopmentPath,
      extensionPaths,
      testRunnerDataDir
    });

    return yield* Effect.tryPromise({
      try: () =>
        open({
          browserType: 'chromium',
          headless: true,
          quality: 'stable',
          port: Number(process.env.PORT) || 3001,
          printServerLog: true,
          verbose: true,
          extensionDevelopmentPath,
          extensionPaths,
          testRunnerDataDir,
          browserOptions: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-features=IsolateOrigins,site-per-process',
            ...(process.env.CI
              ? [
                  '--no-sandbox',
                  '--disable-dev-shm-usage',
                  '--disable-background-timer-throttling',
                  '--disable-backgrounding-occluded-windows',
                  '--disable-renderer-backgrounding'
                ]
              : [])
          ]
        }),
      catch: error => (error instanceof Error ? error : new Error(String(error)))
    });
  });

  await openTask().pipe(
    Effect.retry(
      Schedule.exponential(Duration.seconds(5)).pipe(
        Schedule.compose(Schedule.recurs(2)),
        Schedule.tapOutput(attempt =>
          Effect.logWarning(`⚠️ Headless server start attempt ${attempt + 1} failed, retrying...`)
        )
      )
    ),
    Effect.catchAll(error =>
      Effect.logError('❌ Failed to start headless server after 3 attempts', {
        error: error instanceof Error ? error.message : String(error)
      })
    ),
    Effect.runPromiseExit
  );
};

/** Sets up signal handlers for graceful shutdown */
export const setupSignalHandlers = (): void => {
  const shutdown = (): void => {
    console.log('\n🛑 Shutting down headless server...');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};
