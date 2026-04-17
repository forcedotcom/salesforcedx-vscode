/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';
import type * as vscode from 'vscode';

/** PubSub that broadcasts VS Code configuration-change events.
 * The VS Code wiring (SettingsWatcherLayer) writes to this; consumers subscribe read-only. */
export class SettingsChangePubSub extends Effect.Service<SettingsChangePubSub>()('SettingsChangePubSub', {
  scoped: PubSub.sliding<vscode.ConfigurationChangeEvent>(10_000)
}) {}
