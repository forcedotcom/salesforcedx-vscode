/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';

const snapshotInstalledIds = (): ReadonlySet<string> => new Set(vscode.extensions.all.map(e => e.id));

/**
 * Single shared source of truth for the set of installed/enabled extension ids.
 * vscode.extensions.onDidChange fires on install/uninstall/enable/disable
 * (https://code.visualstudio.com/docs/configure/extensions/extension-marketplace),
 * but does NOT fire when an extension activates. Consumers needing presence/enabled
 * state should subscribe to `changes`; consumers needing isActive must read it directly.
 */
export class ExtensionsService extends Effect.Service<ExtensionsService>()('ExtensionsService', {
  accessors: true,
  scoped: Effect.gen(function* () {
    const ref = yield* SubscriptionRef.make<ReadonlySet<string>>(snapshotInstalledIds());
    const disposable = vscode.extensions.onDidChange(() => {
      Effect.runSync(SubscriptionRef.set(ref, snapshotInstalledIds()));
    });
    yield* Effect.addFinalizer(() => Effect.sync(() => disposable.dispose()));

    const changes: Stream.Stream<ReadonlySet<string>> = ref.changes;
    const get = SubscriptionRef.get(ref);
    const isInstalled = (id: string) => Effect.map(get, ids => ids.has(id));

    return { changes, get, isInstalled };
  })
}) {}
