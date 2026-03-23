/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as path from 'node:path';
import { resolveRepoRoot } from '../utils/repoRoot';

/**
 * Global setup function that downloads VS Code before tests run.
 * This prevents simultaneous downloads when multiple workers start.
 */
export default async (): Promise<void> => {
  const repoRoot = resolveRepoRoot(__dirname);
  const cachePath = path.join(repoRoot, '.vscode-test');
  const version = process.env.PLAYWRIGHT_DESKTOP_VSCODE_VERSION ?? undefined;

  const download = Effect.fn('downloadVSCode')(function* () {
    return yield* Effect.tryPromise({
      try: () => downloadAndUnzipVSCode({ version, cachePath }),
      catch: error => (error instanceof Error ? error : new Error(String(error)))
    }).pipe(
      Effect.retry(
        Schedule.exponential(Duration.seconds(5)).pipe(
          Schedule.compose(Schedule.recurs(2)),
          Schedule.tapOutput(attempt =>
            Effect.logWarning(`⚠️ VS Code download attempt ${attempt + 1} failed, retrying...`)
          )
        )
      )
    );
  });

  await Effect.runPromise(download());
};
