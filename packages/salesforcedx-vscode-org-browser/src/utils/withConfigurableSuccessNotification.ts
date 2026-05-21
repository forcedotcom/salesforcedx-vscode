/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { type CommandKey, showSuccessNotification } from './notificationMode';

/** Tap on an Effect's pipe to show a success notification based on the command's notification mode. */
export const withConfigurableSuccessNotification =
  (command: CommandKey, message: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.tap(effect, () => Effect.sync(() => showSuccessNotification(command, message)));
