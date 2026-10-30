/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  AliasService,
  ConfigService,
  ConnectionService,
  DefaultOrgInfoSchema,
  NoTargetOrgConfiguredError,
  TargetOrgRef
} from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';

const orgRef = Effect.runSync(
  SubscriptionRef.make(Schema.decodeUnknownSync(DefaultOrgInfoSchema)({ orgId: '00D000000000001' }))
);
const runtime = ManagedRuntime.make(
  Layer.mergeAll(
    Layer.succeed(ConnectionService, {
      getConnection: () => Effect.fail(new NoTargetOrgConfiguredError({ message: 'No target org configured' }))
    }),
    Layer.mock(AliasService, { getAliasesFromUsername: () => Effect.succeed(['configured-alias']) }),
    Layer.mock(ConfigService, { getTargetOrg: () => Effect.succeed('configured-alias') }),
    Layer.succeed(TargetOrgRef, orgRef)
  )
);
export const observed = await runtime.runPromise(
  Effect.gen(function* () {
    const aliases = yield* AliasService.use(service => service.getAliasesFromUsername('test@example.com'));
    const target = yield* ConfigService.use(service => service.getTargetOrg());
    const orgIds = yield* TargetOrgRef.pipe(
      Effect.flatMap(ref =>
        SubscriptionRef.changes(ref).pipe(
          Stream.map(org => org.orgId),
          Stream.take(1),
          Stream.runCollect
        )
      )
    );
    const failureTag = yield* ConnectionService.use(service => service.getConnection()).pipe(
      Effect.map(() => 'unexpected-success'),
      Effect.catchTag('NoTargetOrgConfiguredError', error => Effect.succeed(error._tag))
    );
    return { aliases, target, orgIds, failureTag };
  })
);
await runtime.dispose();
