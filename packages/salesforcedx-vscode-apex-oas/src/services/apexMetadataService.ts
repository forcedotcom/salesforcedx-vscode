/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import type {
  ApexClassOASEligibleResponses,
  ApexClassOASGatherContextResponse,
  ApexOASEligiblePayload,
  ApexVSCodeApi
} from 'salesforcedx-vscode-apex';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { ApexExtensionUnavailable, ApexLspRequestFailed } from '../errors';

const APEX_EXTENSION_ID = 'salesforce.salesforcedx-vscode-apex';

const getApexExtension = Effect.fn('ApexOas.Lsp.getApexExtension')(function* () {
  const apexExtension = vscode.extensions.getExtension<ApexVSCodeApi>(APEX_EXTENSION_ID);
  if (!apexExtension) {
    return yield* new ApexExtensionUnavailable({ message: 'Apex extension is not installed' });
  }
  if (!apexExtension.isActive) {
    yield* Effect.tryPromise({
      try: () => apexExtension.activate(),
      catch: cause => new ApexExtensionUnavailable({ message: `Failed to activate Apex extension: ${String(cause)}` })
    });
  }
  return apexExtension;
});

export class ApexMetadataService extends Effect.Service<ApexMetadataService>()('ApexMetadataService', {
  accessors: true,
  effect: Effect.gen(function* () {
    const isOpenAPIEligible = Effect.fn('ApexOas.Lsp.isOpenAPIEligible')(function* (requests: ApexOASEligiblePayload) {
      const ext = yield* getApexExtension();
      const client = ext.exports.languageClientManager.getClientInstance();
      if (!client) {
        return yield* new ApexLspRequestFailed({ message: 'Apex language client is not available' });
      }
      return yield* Effect.tryPromise({
        try: () => client.isOpenAPIEligible(requests),
        catch: cause =>
          new ApexLspRequestFailed({ message: `apexoas/isEligible request failed: ${String(cause)}`, cause })
      }).pipe(
        Effect.flatMap(response =>
          response
            ? Effect.succeed<ApexClassOASEligibleResponses>(response)
            : new ApexLspRequestFailed({ message: 'apexoas/isEligible returned no response' })
        )
      );
    });

    const gatherOpenAPIContext = Effect.fn('ApexOas.Lsp.gatherOpenAPIContext')(function* (sourceUri: URI | URI[]) {
      const ext = yield* getApexExtension();
      const client = ext.exports.languageClientManager.getClientInstance();
      if (!client) {
        return yield* new ApexLspRequestFailed({ message: 'Apex language client is not available' });
      }
      return yield* Effect.tryPromise({
        try: async (): Promise<ApexClassOASGatherContextResponse> => client.gatherOpenAPIContext(sourceUri),
        catch: cause =>
          new ApexLspRequestFailed({ message: `apexoas/gatherContext request failed: ${String(cause)}`, cause })
      });
    });

    return { isOpenAPIEligible, gatherOpenAPIContext };
  })
}) {}
