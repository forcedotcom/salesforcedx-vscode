/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type * as Cause from 'effect/Cause';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

export class ErrorHandlerService extends Context.Service<
  ErrorHandlerService,
  { readonly handleCause: (cause: Cause.Cause<unknown>) => Effect.Effect<void> }
>()('@salesforce/vscode-services/v2/ErrorHandlerService') {}
