/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Config } from '@salesforce/core/config';
import { Global } from '@salesforce/core/global';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { clearDefaultOrgRef } from './defaultOrgRef';

// --- INSTRUMENTATION: remove before shipping ---
// eslint-disable-next-line functional/no-let
let received = 0;
setInterval(() => {
  console.log(`[After Measurement] configFileWatcher: received ${received}`);
}, 10_000);
// --- END INSTRUMENTATION ---

export const watchConfigFiles = Effect.fn('watchConfigFiles')(function* () {
  const configFileName = Config.getFileName();

  const globalWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(URI.file(Global.DIR), configFileName)
  );
  const projectWatcher = vscode.workspace.createFileSystemWatcher(
    `**/${Global.SF_STATE_FOLDER}/${configFileName}`
  );

  const configChangeStream = Stream.async<void>(emit => {
    const fire = () => { received++; void emit.single(undefined); };
    globalWatcher.onDidCreate(fire);
    globalWatcher.onDidChange(fire);
    globalWatcher.onDidDelete(fire);
    projectWatcher.onDidCreate(fire);
    projectWatcher.onDidChange(fire);
    projectWatcher.onDidDelete(fire);
    return Effect.sync(() => {
      globalWatcher.dispose();
      projectWatcher.dispose();
    });
  });

  yield* configChangeStream.pipe(
    Stream.debounce(Duration.millis(5)),
    Stream.tap(() => ConfigService.invalidateConfigAggregator()),
    Stream.tap(() => ConnectionService.invalidateCachedConnections()),
    Stream.runForEach(() => ConnectionService.getConnection().pipe(Effect.catchAll(() => clearDefaultOrgRef())))
  );
});
