/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CallableSchema, getExtensionExports } from '@salesforce/effect-ext-utils';
import * as Context from 'effect/Context';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { isNotUndefined } from 'effect/Predicate';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import type { ApexOASEligiblePayload, ApexVSCodeApi } from 'salesforcedx-vscode-apex';
import type { URI } from 'vscode-uri';
import { ApexExtensionUnavailable, ApexLspNotReady, ApexLspRequestFailed } from '../errors';
import { nls } from '../messages/nls';

const APEX_EXTENSION_ID = 'salesforce.salesforcedx-vscode-apex';

// The Apex LS reports Indexing until it finishes; poll every 500ms for up to 2 minutes.
const LSP_READY_SCHEDULE = Schedule.fixed(Duration.millis(500));

const languageClientManagerSchema = Schema.Struct({
  getClientInstance: CallableSchema<ApexVSCodeApi['languageClientManager']['getClientInstance']>(),
  getStatus: CallableSchema<ApexVSCodeApi['languageClientManager']['getStatus']>()
}).pipe(Schema.is, Schema.declare<Pick<ApexVSCodeApi['languageClientManager'], 'getClientInstance' | 'getStatus'>>);

const getApexExtension = Effect.fn('ApexOas.Lsp.getApexExtension')(() =>
  getExtensionExports({
    extId: APEX_EXTENSION_ID,
    schema: Schema.Struct({
      gatherOpenAPIContext: CallableSchema<ApexVSCodeApi['gatherOpenAPIContext']>(),
      isOpenAPIEligible: CallableSchema<ApexVSCodeApi['isOpenAPIEligible']>(),
      languageClientManager: languageClientManagerSchema
    })
  }).pipe(
    Effect.catchTags({
      ExtensionNotFoundError: () =>
        Effect.fail(new ApexExtensionUnavailable({ message: 'Apex extension is not installed' })),
      ExtensionActivationError: ({ cause }) =>
        Effect.fail(
          new ApexExtensionUnavailable({
            message: `Failed to activate Apex extension: ${String(cause)}`
          })
        )
    })
  )
);

// One readiness probe: ready → succeed; init failed → fail fast (non-retryable); still indexing → retryable.
export const probeReady = Effect.fn('ApexOas.Lsp.probeReady')(function* (
  manager: Pick<ApexVSCodeApi['languageClientManager'], 'getClientInstance' | 'getStatus'>
) {
  const apexClient = manager.getClientInstance();
  const languageClientStatus = manager.getStatus();
  yield* Effect.succeed(languageClientStatus).pipe(
    Effect.filterOrFail(
      status => !status.failedToInitialize(),
      status =>
        new ApexLspRequestFailed({
          message: `Apex Language Server failed to initialize: ${status.getStatusMessage()}`
        })
    )
  );
  return yield* Effect.succeed(apexClient).pipe(
    Effect.filterOrFail(
      (client): client is NonNullable<typeof apexClient> => isNotUndefined(client) && languageClientStatus.isReady(),
      () => new ApexLspNotReady({ message: nls.localize('apex_lsp_not_ready') })
    )
  );
});

const getApexApi = Effect.fn('ApexOas.Lsp.getApexApi')(function* () {
  const apexApi = yield* getApexExtension();
  // The OAS commands can fire before indexing completes (activation is deferred), so wait for Ready.
  yield* probeReady(apexApi.languageClientManager).pipe(
    Effect.retry({ schedule: LSP_READY_SCHEDULE, times: 240, while: error => error._tag === 'ApexLspNotReady' })
  );
  return apexApi;
});

const makeApexMetadataService = Effect.gen(function* () {
  const isOpenAPIEligible = Effect.fn('ApexOas.Lsp.isOpenAPIEligible')(function* (requests: ApexOASEligiblePayload) {
    const apexApi = yield* getApexApi();
    return yield* Effect.tryPromise({
      try: () => apexApi.isOpenAPIEligible(requests),
      catch: cause =>
        new ApexLspRequestFailed({ message: `apexoas/isEligible request failed: ${String(cause)}`, cause })
    }).pipe(
      Effect.filterOrFail(
        isNotUndefined,
        () => new ApexLspRequestFailed({ message: 'apexoas/isEligible returned no response' })
      )
    );
  });

  const gatherOpenAPIContext = Effect.fn('ApexOas.Lsp.gatherOpenAPIContext')(function* (sourceUri: URI) {
    const apexApi = yield* getApexApi();
    return yield* Effect.tryPromise({
      try: () => apexApi.gatherOpenAPIContext(sourceUri),
      catch: cause =>
        new ApexLspRequestFailed({ message: `apexoas/gatherContext request failed: ${String(cause)}`, cause })
    }).pipe(
      Effect.filterOrFail(
        isNotUndefined,
        () => new ApexLspRequestFailed({ message: 'apexoas/gatherContext returned no response' })
      )
    );
  });

  return { isOpenAPIEligible, gatherOpenAPIContext };
});

export class ApexMetadataService extends Context.Service<
  ApexMetadataService,
  Effect.Success<typeof makeApexMetadataService>
>()('ApexMetadataService') {
  public static readonly layer = Layer.effect(ApexMetadataService, makeApexMetadataService);
}
