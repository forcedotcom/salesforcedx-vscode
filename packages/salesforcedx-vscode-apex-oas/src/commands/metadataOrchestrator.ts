/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import type { URI } from 'vscode-uri';
import { nls } from '../messages/nls';
import { type OasSourceAnalysis } from '../oas/apexSourceMetadata';
import { qualifyOasAnalysis, type OasQualification } from '../oas/oasQualification';
import { ApexMetadataService } from '../services/apexMetadataService';

export class ClassNotEligible extends Data.TaggedError('ClassNotEligible')<{
  readonly message: string;
}> {}

export class ContextGatheringFailed extends Data.TaggedError('ContextGatheringFailed')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/** @ExportTaggedError */
export class ResourceUriUnresolved extends Data.TaggedError('ResourceUriUnresolved')<{
  readonly message: string;
}> {}

type OasCommandAnalysis = {
  readonly source: OasSourceAnalysis;
  readonly qualification: OasQualification;
};

const resolveResourceUri = Effect.fn('ApexOas.Metadata.resolveResourceUri')(function* (sourceUri: URI | URI[]) {
  if (Array.isArray(sourceUri)) {
    return yield* new ResourceUriUnresolved({
      message: 'Cannot resolve a single Apex class URI for OAS Generation. Select one class file.'
    });
  }
  if (sourceUri) return sourceUri;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.EditorService.getActiveEditorUri().pipe(
    Effect.catchTag(
      'NoActiveEditorError',
      () =>
        new ResourceUriUnresolved({
          message:
            'Cannot resolve URI for OAS Generation request. Please ensure that the location used to launch the command is from a file, folder or active editor'
        })
    )
  );
});

/** Resolves current source metadata through the new Apex LS and classifies OAS framework eligibility. */
export const analyzeMetadata = Effect.fn('ApexOas.Metadata.analyze')(function* (sourceUri: URI | URI[]) {
  const resourceUri = yield* resolveResourceUri(sourceUri);
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ProjectService.ensureInPackageDirectories([resourceUri]).pipe(
    Effect.mapError(cause => new ContextGatheringFailed({ message: nls.localize('cannot_gather_context'), cause }))
  );
  const source = yield* ApexMetadataService.analyze(resourceUri).pipe(
    Effect.mapError(cause => new ContextGatheringFailed({ message: nls.localize('cannot_gather_context'), cause }))
  );
  return { source, qualification: qualifyOasAnalysis(source) } satisfies OasCommandAnalysis;
});
