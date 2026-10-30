/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChannelService } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';

/** One default services channel per graph; every dependent slice reuses this exact layer value. */
export const ChannelServiceLayer = Layer.effect(
  ChannelService,
  Effect.gen(function* () {
    const operations = yield* ServiceOperations;
    const channel = yield* Effect.acquireRelease(
      Effect.sync(() => vscode.window.createOutputChannel('Salesforce Services')),
      value => Effect.sync(() => value.dispose())
    );
    yield* Effect.addFinalizer(() => operations.close);
    return ChannelService.of({
      getChannel: operations.run(Effect.succeed(channel)),
      showChannel: operations.run(Effect.sync(() => channel.show())),
      clearChannel: operations.run(
        Effect.try(() => channel.clear()).pipe(Effect.catchTag('UnknownError', () => Effect.void))
      ),
      // Logging is best-effort; caller cancellation still propagates.
      appendToChannel: Effect.fn('ChannelService.appendToChannel')(
        (message: string) =>
          Effect.try(() => channel.appendLine(message)).pipe(Effect.catchTag('UnknownError', () => Effect.void)),
        operations.run
      )
    });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
