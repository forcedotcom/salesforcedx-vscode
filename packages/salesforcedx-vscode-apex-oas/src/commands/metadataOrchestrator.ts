/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ApexOASResource } from '../oas/schemas';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as path from 'node:path';
import type { ApexClassOASEligibleRequest, ApexOASEligiblePayload } from 'salesforcedx-vscode-apex';
import type { URI } from 'vscode-uri';
import { ApexLspRequestFailed } from '../errors';
import { nls } from '../messages/nls';
import { ApexMetadataService } from '../services/apexMetadataService';

export class ClassNotEligible extends Data.TaggedError('ClassNotEligible')<{
  readonly message: string;
}> {}

/** @ExportTaggedError */
export class ContextGatheringFailed extends Data.TaggedError('ContextGatheringFailed')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/** @ExportTaggedError */
export class ResourceUriUnresolved extends Data.TaggedError('ResourceUriUnresolved')<{
  readonly message: string;
}> {}

const buildRequestTarget = (requestPayload: ApexOASEligiblePayload): ApexOASResource => {
  const payload = requestPayload.payload;
  if (payload.length > 1) return 'MULTI CLASSES';
  const request = payload[0];
  if (!request.includeAllMethods && !request.includeAllProperties) return 'METHOD or PROPERTY';
  return !request.resourceUri?.fsPath.endsWith('.cls') ? 'FOLDER' : 'CLASS';
};

const eligibilityDelegate = Effect.fn('ApexOas.Metadata.eligibilityDelegate')(function* (
  requests: ApexOASEligiblePayload
) {
  const target = buildRequestTarget(requests);
  yield* Effect.annotateCurrentSpan({ classNumbers: requests.payload.length, requestTarget: target });
  return yield* ApexMetadataService.isOpenAPIEligible(requests).pipe(
    Effect.mapError(
      cause => new ApexLspRequestFailed({ message: nls.localize('cannot_get_apexoaseligibility_response'), cause })
    )
  );
});

const buildRequests = Effect.fn('ApexOas.Metadata.buildRequests')(function* (sourceUri: URI | URI[]) {
  if (Array.isArray(sourceUri)) {
    return sourceUri.map(uri => ({
      resourceUri: uri,
      includeAllMethods: true,
      includeAllProperties: true,
      methodNames: [],
      position: null,
      propertyNames: []
    })) satisfies ApexClassOASEligibleRequest[];
  }

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const resourceUri =
    sourceUri ??
    (yield* api.services.EditorService.getActiveEditorUri().pipe(
      Effect.catchTag(
        'NoActiveEditorError',
        () =>
          new ResourceUriUnresolved({
            message:
              'Cannot resolve URI for OAS Generation request. Please ensure that the location used to launch the command is from a file, folder or active editor'
          })
      )
    ));

  return [
    {
      resourceUri,
      includeAllMethods: true,
      includeAllProperties: true,
      position: null,
      methodNames: [],
      propertyNames: []
    }
  ] satisfies ApexClassOASEligibleRequest[];
});

/**
 * Validates and extracts metadata for the method at the current cursor position.
 * @returns The metadata of the method, or fails with ClassNotEligible.
 */
export const validateMetadata = Effect.fn('ApexOas.Metadata.validate')(function* (sourceUri: URI | URI[]) {
  const requests = yield* buildRequests(sourceUri);
  const isEligibleResponses = yield* eligibilityDelegate({ payload: requests }).pipe(
    Effect.tap(responses => Effect.annotateCurrentSpan({ eligibleResponses: JSON.stringify(responses) }))
  );

  const first = isEligibleResponses?.[0];
  if (!first) {
    return yield* new ClassNotEligible({ message: nls.localize('validation_failed') });
  }
  if (!first.isApexOasEligible && !first.isEligible) {
    return yield* new ClassNotEligible({
      message: nls.localize(
        'apex_class_not_valid',
        first.resourceUri?.fsPath ? path.basename(first.resourceUri.fsPath, '.cls') : 'unknown'
      )
    });
  }
  const eligibleSymbols = (first.symbols ?? []).filter(s => s.isApexOasEligible || s.isEligible);
  if (eligibleSymbols.length === 0) {
    const className = path.basename(first.resourceUri.fsPath, '.cls');
    // Name the ineligible methods so the user knows which symbols to annotate/adjust, instead of a bare class name.
    const ineligibleNames = (first.symbols ?? [])
      .filter(s => !s.isApexOasEligible && !s.isEligible)
      .map(s => s.docSymbol.name)
      .join(', ');
    return yield* new ClassNotEligible({
      message: ineligibleNames
        ? nls.localize('apex_class_no_eligible_methods', className, ineligibleNames)
        : nls.localize('apex_class_not_valid', className)
    });
  }
  return first;
});

export const gatherContext = Effect.fn('ApexOas.Metadata.gatherContext')(function* (sourceUri: URI | URI[]) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const uri =
    sourceUri ??
    (yield* api.services.EditorService.getActiveEditorUri().pipe(
      Effect.catchTag(
        'NoActiveEditorError',
        () => new ContextGatheringFailed({ message: nls.localize('cannot_gather_context') })
      )
    ));
  return yield* ApexMetadataService.gatherOpenAPIContext(uri).pipe(
    Effect.mapError(cause => new ContextGatheringFailed({ message: nls.localize('cannot_gather_context'), cause })),
    Effect.tap(response => Effect.annotateCurrentSpan({ context: JSON.stringify(response) }))
  );
});
