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
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';

import * as SubscriptionRef from 'effect/SubscriptionRef';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { SdkLayer } from '../observability/spans';

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

/** watch the global and local sf/config.json files; clear the defaultOrgRef when they change */
export const watchConfigFiles = (): Effect.Effect<void, Error> =>
  Effect.scoped(
    Effect.gen(function* () {
      const configFileName = Config.getFileName();
      const globalConfigWatcher = vscode.workspace.createFileSystemWatcher(join(Global.DIR, configFileName));
      const projectConfigWatcher = vscode.workspace.createFileSystemWatcher(
        `**/${Global.SF_STATE_FOLDER}/${configFileName}`
      );

      globalConfigWatcher.onDidChange(() => clearDefaultOrgRef());
      globalConfigWatcher.onDidCreate(() => clearDefaultOrgRef());
      globalConfigWatcher.onDidDelete(() => clearDefaultOrgRef());
      projectConfigWatcher.onDidChange(() => clearDefaultOrgRef());
      projectConfigWatcher.onDidCreate(() => clearDefaultOrgRef());
      projectConfigWatcher.onDidDelete(() => clearDefaultOrgRef());

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          globalConfigWatcher.dispose();
          projectConfigWatcher.dispose();
        }).pipe(Effect.withSpan('disposing of file watchers'))
      );

      // keep these file watcher running until the parent scope closes
      yield* Effect.sleep(Duration.infinity);
    })
  );
