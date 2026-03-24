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
 * @vscode/test-electron retries 3x internally (DOWNLOAD_ATTEMPTS=3) with no delay.
 * This wrapper adds a 30s spaced retry so the CDN has time to recover between
 * groups of internal attempts (e.g. after 0-byte / ECONNRESET failures).
 */
export const downloadVSCodeWithRetry = (
  version: string | undefined,
  cachePath: string
): Effect.Effect<string, Error, never> =>
  Effect.tryPromise({
    try: () => downloadAndUnzipVSCode({ version, cachePath }),
    catch: error => (error instanceof Error ? error : new Error(String(error)))
  }).pipe(
    Effect.retry(
      Schedule.spaced(Duration.seconds(30)).pipe(
        Schedule.compose(Schedule.recurs(1)),
        Schedule.tapOutput(attempt =>
          Effect.logWarning(`VS Code download failed (attempt ${attempt + 1}), retrying in 30s...`)
        )
      )
    ),
    Effect.flatMap(executablePath =>
      executablePath
        ? Effect.succeed(executablePath)
        : Effect.fail(new Error('VS Code download returned undefined executable path'))
    )
  );
