/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';
import * as Schema from 'effect/Schema';
import { URI } from 'vscode-uri';
import { MetadataChangeType } from './sdrGuards';

// URI has a protected constructor so Schema.instanceOf doesn't apply; use Schema.declare with instanceof predicate
const UriSchema = Schema.declare((u): u is URI => u instanceof URI, {
  identifier: 'URI',
  description: 'vscode-uri URI'
});

export const MetadataChangeEvent = Schema.Struct({
  metadataType: Schema.String,
  fullName: Schema.String,
  changeType: MetadataChangeType,
  fileUri: Schema.optionalWith(UriSchema, { as: 'Option' })
});
export type MetadataChangeEvent = Schema.Schema.Type<typeof MetadataChangeEvent>;

/** Publishes one event per component after a successful deploy. Subscribers use Stream.fromPubSub(pubsub). */
export class MetadataChangeNotificationService extends Effect.Service<MetadataChangeNotificationService>()(
  'MetadataChangeNotificationService',
  {
    effect: Effect.gen(function* () {
      const pubsub = yield* PubSub.sliding<MetadataChangeEvent>(10_000);
      return { pubsub };
    })
  }
) {}
