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

/**
 * Downloads and unzips VS Code with retries.
 * @param version VS Code version to download
 * @param cachePath Path to cache the download
 * @returns Effect that resolves to the executable path
 */
export const downloadVSCodeWithRetry = (
  version: string | undefined,
  cachePath: string
): Effect.Effect<string, Error, never> => {
  const downloadTask = Effect.fn('downloadVSCode')(function* () {
    return yield* Effect.tryPromise({
      try: () => downloadAndUnzipVSCode({ version, cachePath }),
      catch: error => (error instanceof Error ? error : new Error(String(error)))
    });
  });

  return downloadTask().pipe(
    Effect.retry(
      Schedule.exponential(Duration.seconds(5)).pipe(
        Schedule.compose(Schedule.recurs(4)),
        Schedule.tapOutput(attempt =>
          Effect.logWarning(`⚠️ VS Code download attempt ${attempt + 1} failed, retrying...`)
        )
      )
    ),
    Effect.flatMap(executablePath =>
      executablePath
        ? Effect.succeed(executablePath)
        : Effect.fail(new Error('VS Code download returned undefined executable path'))
    )
  );
};
