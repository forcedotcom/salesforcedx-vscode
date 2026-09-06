/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import * as Schedule from 'effect/Schedule';
import type {
  ApexClassOASGatherContextResponse,
  ApexOASEligiblePayload,
  ApexVSCodeApi
} from 'salesforcedx-vscode-apex';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { ApexExtensionUnavailable, ApexLspNotReady, ApexLspRequestFailed } from '../errors';
import { nls } from '../messages/nls';

const APEX_EXTENSION_ID = 'salesforce.salesforcedx-vscode-apex';

// The Apex LS reports Indexing until it finishes; poll every 500ms for up to 2 minutes.
const LSP_READY_SCHEDULE = Schedule.fixed(Duration.millis(500)).pipe(Schedule.intersect(Schedule.recurs(240)));

const getApexExtension = Effect.fn('ApexOas.Lsp.getApexExtension')(function* () {
  const apexExtension = yield* Effect.sync(() => vscode.extensions.getExtension<ApexVSCodeApi>(APEX_EXTENSION_ID)).pipe(
    Effect.filterOrFail(
      isNotUndefined,
      () => new ApexExtensionUnavailable({ message: 'Apex extension is not installed' })
    )
  );
  if (!apexExtension.isActive) {
    yield* Effect.tryPromise({
      try: () => apexExtension.activate(),
      catch: cause => new ApexExtensionUnavailable({ message: `Failed to activate Apex extension: ${String(cause)}` })
    });
  }
  return apexExtension;
});

// One readiness probe: ready → succeed; init failed → fail fast (non-retryable); still indexing → retryable.
export const probeReady = Effect.fn('ApexOas.Lsp.probeReady')(function* (
  manager: ApexVSCodeApi['languageClientManager']
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

const getClient = Effect.fn('ApexOas.Lsp.getClient')(function* () {
  const ext = yield* getApexExtension();
  // The OAS commands can fire before indexing completes (activation is deferred), so wait for Ready.
  return yield* probeReady(ext.exports.languageClientManager).pipe(
    Effect.retry({ schedule: LSP_READY_SCHEDULE, while: error => error._tag === 'ApexLspNotReady' })
  );
});

export class ApexMetadataService extends Effect.Service<ApexMetadataService>()('ApexMetadataService', {
  accessors: true,
  effect: Effect.gen(function* () {
    const isOpenAPIEligible = Effect.fn('ApexOas.Lsp.isOpenAPIEligible')(function* (requests: ApexOASEligiblePayload) {
      const client = yield* getClient();
      return yield* Effect.tryPromise({
        try: () => client.isOpenAPIEligible(requests),
        catch: cause =>
          new ApexLspRequestFailed({ message: `apexoas/isEligible request failed: ${String(cause)}`, cause })
      }).pipe(
        Effect.filterOrFail(
          isNotUndefined,
          () => new ApexLspRequestFailed({ message: 'apexoas/isEligible returned no response' })
        )
      );
    });

    const gatherOpenAPIContext = Effect.fn('ApexOas.Lsp.gatherOpenAPIContext')(function* (sourceUri: URI | URI[]) {
      const client = yield* getClient();
      return yield* Effect.tryPromise({
        try: async (): Promise<ApexClassOASGatherContextResponse> => client.gatherOpenAPIContext(sourceUri),
        catch: cause =>
          new ApexLspRequestFailed({ message: `apexoas/gatherContext request failed: ${String(cause)}`, cause })
      });
    });

    return { isOpenAPIEligible, gatherOpenAPIContext };
  })
}) {}
