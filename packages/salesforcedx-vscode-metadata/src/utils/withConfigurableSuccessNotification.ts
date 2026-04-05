/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';

const SECTION = 'salesforcedx-vscode-metadata';
const KEY = 'show-success-notification';

/** put this Tap on an Effect's pipe to optionally show a success toast based on the value of the config.*/
export const withConfigurableSuccessNotification =
  (message: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.tap(effect, () =>
      Effect.sync(() => {
        const show = vscode.workspace.getConfiguration(SECTION).get<boolean>(KEY, false);
        if (show) void vscode.window.showInformationMessage(message);
      })
    );
