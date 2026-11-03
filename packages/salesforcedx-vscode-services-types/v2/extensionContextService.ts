/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import type { ExtensionContext } from 'vscode';

export class ExtensionContextService extends Context.Service<
  ExtensionContextService,
  {
    readonly scope: Scope.Closeable;
    readonly getContext: Effect.Effect<ExtensionContext>;
    readonly getDisplayName: Effect.Effect<string | undefined>;
  }
>()('@salesforce/vscode-services/v2/ExtensionContextService') {}

const DisplayNameSchema = Schema.Struct({ displayName: Schema.optional(Schema.String) });

/** A caller's native extension context, never a fallback to the services extension's context. */
export const ExtensionContextServiceLayer = (context: ExtensionContext) => {
  const displayName = Schema.decodeUnknownOption(DisplayNameSchema)(context.extension.packageJSON).pipe(
    Option.map(value => value.displayName),
    Option.getOrUndefined
  );
  return Layer.effect(
    ExtensionContextService,
    Effect.gen(function* () {
      const scope = yield* Effect.acquireRelease(Scope.make(), value => Scope.close(value, Exit.void));
      return ExtensionContextService.of({
        scope,
        getContext: Effect.succeed(context),
        getDisplayName: Effect.succeed(displayName)
      });
    })
  );
};
