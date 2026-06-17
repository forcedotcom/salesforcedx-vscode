/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { ExtensionContextService } from '../vscode/extensionContextService';

/** Read a string-valued globalState key as Option. */
export const readGlobalStateKey = Effect.fn('readGlobalStateKey')(function* (key: string) {
  const contextService = yield* ExtensionContextService;
  const extensionContext = yield* contextService.getContext;
  return Option.fromNullable(extensionContext.globalState.get<string | undefined>(key));
});
