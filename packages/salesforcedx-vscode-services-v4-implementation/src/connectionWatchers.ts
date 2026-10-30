/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Config } from '@salesforce/core/config';
import { Global } from '@salesforce/core/global';
import {
  AliasService,
  ChannelService,
  FileChangePubSub,
  HostFileWatcher,
  SettingsChangePubSub,
  type HostFileNotFoundError,
  type HostFileWatchError
} from '@salesforce/vscode-services-v2';
import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import { URI, Utils } from 'vscode-uri';
import { DefaultOrgConnection } from './connectionService.js';
import { HostFileWatchReady } from './hostFileWatcher.js';
import { makeScopedFibers } from './scopedFiber.js';
import { OrgChanges } from './targetOrgRef.js';

const mergeAliases = (current: readonly string[] | undefined, fresh: string[]) =>
  current?.[0] && fresh.includes(current[0]) ? [current[0], ...fresh.filter(alias => alias !== current[0])] : fresh;

/** Registration receipts complete before publishing the graph; every fiber belongs to its scope. */
export const ConnectionWatcherLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const scopedFibers = yield* makeScopedFibers;
    const watcher = yield* HostFileWatcher;
    const alias = yield* AliasService;
    const orgChanges = yield* OrgChanges;
    const connection = yield* DefaultOrgConnection;
    const channel = yield* ChannelService;
    const projectChanges = yield* FileChangePubSub.pipe(Effect.flatMap(PubSub.subscribe));
    const settingsChanges = yield* SettingsChangePubSub.pipe(Effect.flatMap(PubSub.subscribe));
    const configName = Config.getFileName();
    const aliasReady = yield* Deferred.make<void, HostFileNotFoundError | HostFileWatchError>();
    const configReady = yield* Deferred.make<void, HostFileNotFoundError | HostFileWatchError>();
    yield* watcher.watch(Utils.joinPath(URI.file(Global.SFDX_DIR), 'alias.json').fsPath).pipe(
      Stream.provideService(HostFileWatchReady, Option.some(aliasReady)),
      Stream.debounce(Duration.millis(50)),
      Stream.runForEach(() =>
        orgChanges.snapshot.pipe(
          Effect.flatMap(before =>
            before.org.username
              ? alias
                  .getAliasesFromUsername(before.org.username)
                  .pipe(
                    Effect.flatMap(fresh =>
                      orgChanges.update(before.generation, current =>
                        Effect.succeed(
                          current.org.username === before.org.username && current.org.orgId === before.org.orgId
                            ? { ...current.org, aliases: mergeAliases(current.org.aliases, fresh) }
                            : current.org
                        )
                      )
                    )
                  )
              : Effect.void
          )
        )
      ),
      Effect.onExit(exit => Deferred.done(aliasReady, Exit.isSuccess(exit) ? Exit.interrupt() : exit)),
      scopedFibers.fork
    );
    const globalChanges = watcher.watch(Utils.joinPath(URI.file(Global.SF_DIR), configName).fsPath).pipe(
      Stream.provideService(HostFileWatchReady, Option.some(configReady)),
      Stream.catchTag('HostFileWatchError', error =>
        Stream.fromEffect(
          Effect.logWarning('Global config file watch failed; continuing with project config watch', {
            path: error.path,
            reason: error.message
          }).pipe(Effect.andThen(Deferred.succeed(configReady, undefined)))
        ).pipe(Stream.drain)
      )
    );
    yield* Stream.merge(
      globalChanges,
      Stream.fromSubscription(projectChanges).pipe(
        Stream.filter(
          event =>
            Utils.basename(event.uri) === configName &&
            Utils.basename(Utils.dirname(event.uri)) === Global.SF_STATE_FOLDER
        )
      )
    ).pipe(
      Stream.debounce(Duration.millis(5)),
      Stream.runForEach(() => connection.refresh),
      Effect.onExit(exit => Deferred.done(configReady, Exit.isSuccess(exit) ? Exit.interrupt() : exit)),
      scopedFibers.fork
    );
    yield* Stream.fromSubscription(settingsChanges).pipe(
      Stream.filter(event =>
        ['instanceUrl', 'accessToken', 'apiVersion'].some(key =>
          event.affectsConfiguration(`salesforce-web-console.${key}`)
        )
      ),
      Stream.debounce(Duration.millis(100)),
      Stream.tap(() => channel.appendToChannel('ConfigChanged: Web Auth')),
      Stream.runForEach(() => connection.authSettingsChanged),
      scopedFibers.fork
    );
    yield* Deferred.await(aliasReady);
    // Global watch failures are isolated; project subscription above is still live.
    yield* Deferred.await(configReady).pipe(Effect.catchTag('HostFileWatchError', () => Effect.void));
  })
);
