/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Config } from '@salesforce/core/config';
import { Global } from '@salesforce/core/global';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { join } from 'node:path';
import { Utils, type URI } from 'vscode-uri';
import { FileChangePubSub } from '../vscode/fileChangePubSub';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { clearDefaultOrgRef } from './defaultOrgRef';
import { HostFileWatcher } from './hostFileWatcher';

const isProjectConfigFile = (uri: URI, configFileName: string): boolean =>
  Utils.basename(uri) === configFileName && Utils.basename(Utils.dirname(uri)) === Global.SF_STATE_FOLDER;

/**
 * Watch global `~/.sf/config.json` (HostFileWatcher) and project `.sf/config.json` (FileChangePubSub).
 * Reload connection on change; clear defaultOrgRef if getConnection fails.
 * Isolates `HostFileWatchError` on the global stream so project watching continues.
 */
export const watchConfigFiles = Effect.fn('watchConfigFiles')(function* () {
  const configFileName = Config.getFileName();
  const globalConfigPath = join(Global.SF_DIR, configFileName);

  const [fileChangePubSub, hostFileWatcher] = yield* Effect.all([FileChangePubSub, HostFileWatcher], {
    concurrency: 'unbounded'
  });

  const projectConfigChanges = Stream.fromPubSub(fileChangePubSub).pipe(
    Stream.filter(event => isProjectConfigFile(event.uri, configFileName))
  );
  const globalConfigChanges = hostFileWatcher.watch(globalConfigPath).pipe(
    Stream.catchTag('HostFileWatchError', error =>
      Stream.fromEffect(
        Effect.logWarning('Global config file watch failed; continuing with project config watch', {
          path: error.path,
          reason: error.message
        })
      ).pipe(Stream.drain)
    )
  );

  yield* Stream.merge(projectConfigChanges, globalConfigChanges).pipe(
    Stream.debounce(Duration.millis(5)),
    Stream.tap(() => ConfigService.invalidateConfigAggregator()),
    Stream.tap(() => ConnectionService.invalidateCachedConnections()),
    // getConnection updates defaultOrgRef; clear on failure.
    Stream.runForEach(() => ConnectionService.getConnection().pipe(Effect.catchAll(() => clearDefaultOrgRef())))
  );
});
