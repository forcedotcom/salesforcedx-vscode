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
import * as PubSub from 'effect/PubSub';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { join, normalize, sep } from 'node:path';
import { SdkLayer } from '../observability/spans';
import { FileWatcherService } from '../vscode/fileWatcherService';

export const DefaultOrgInfoSchema = Schema.Struct({
  orgId: Schema.optional(Schema.String),
  devHubOrgId: Schema.optional(Schema.String),
  username: Schema.optional(Schema.String),
  devHubUsername: Schema.optional(Schema.String),
  tracksSource: Schema.optional(Schema.Boolean),
  isScratch: Schema.optional(Schema.Boolean),
  isSandbox: Schema.optional(Schema.Boolean)
});

// A "global" ref that can be accessed anywhere in the program
export const defaultOrgRef = Effect.runSync(SubscriptionRef.make<typeof DefaultOrgInfoSchema.Type>({}));

const clearDefaultOrgRef = (): void =>
  Effect.runSync(
    Ref.update(defaultOrgRef, () => ({})).pipe(Effect.withSpan('cleared defaultOrgRef'), Effect.provide(SdkLayer))
  );

/** Check if a file path is a config file (global or project-specific) */
const isConfigFile = (path: string, globalConfigPath: string, projectConfigPattern: string): boolean => {
  const normalizedPath = normalize(path);
  return normalizedPath === globalConfigPath || normalizedPath.includes(projectConfigPattern);
};

/** watch the global and local sf/config.json files; clear the defaultOrgRef when they change */
export const watchConfigFiles = (): Effect.Effect<void, never, FileWatcherService> =>
  Effect.scoped(
    Effect.gen(function* () {
      const configFileName = Config.getFileName();
      const globalConfigPath = normalize(join(Global.DIR, configFileName));
      const projectConfigPattern = `${Global.SF_STATE_FOLDER}${sep}${configFileName}`;

      const fileWatcherService = yield* FileWatcherService;
      const dequeue = yield* PubSub.subscribe(fileWatcherService.pubsub);

      // Subscribe to file changes and clear defaultOrgRef when config files change
      yield* Stream.fromQueue(dequeue).pipe(
        Stream.filter(event => isConfigFile(event.uri.fsPath, globalConfigPath, projectConfigPattern)),
        Stream.debounce(Duration.millis(5)),
        Stream.runForEach(() => Effect.sync(() => clearDefaultOrgRef()))
      );
    })
  );
