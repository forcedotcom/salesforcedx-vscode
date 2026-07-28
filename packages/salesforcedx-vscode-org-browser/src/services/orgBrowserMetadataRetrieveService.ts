/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { MetadataMember } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import { isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';

/** @ExportTaggedError See docs on TS4023 errors for more information about why this is needed*/
export class NoFilesRetrievedError extends Schema.TaggedError<NoFilesRetrievedError>()('NoFilesRetrievedError', {
  message: Schema.String
}) {}

const retrieve = Effect.fn('OrgBrowserRetrieveService.retrieve')(function* (
  members: MetadataMember[],
  openInEditor = false
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channel = yield* api.services.ChannelService;

  const result = yield* api.services.MetadataRetrieveService.retrieve(members, { ignoreConflicts: true });
  if (isString(result)) {
    return result;
  }
  const fileResponses = result.getFileResponses().filter(f => f.filePath);
  yield* channel.appendToChannel(`Retrieve completed. ${fileResponses.length} files retrieved successfully.`);
  if (fileResponses.length > 0) {
    yield* channel.appendToChannel(
      `${['Retrieved files: '].concat(fileResponses!.map(f => `  - ${f.filePath} : ${f.type}`)).join('\n')}`
    );
  } else {
    return yield* new NoFilesRetrievedError({ message: 'No files retrieved' });
  }

  if (openInEditor) {
    const fsService = yield* api.services.FsService;
    const member = members[0];
    const orgId = (yield* SubscriptionRef.get(yield* api.services.TargetOrgRef())).orgId;
    if (member && orgId) {
      const resolver = yield* api.services.OrgMetadataResolver;
      const canonicalUri = api.services.orgMetadataUri({
        orgKey: orgId,
        xmlName: member.type,
        fullName: member.fullName
      });
      yield* resolver.invalidate();
      const targetUri = yield* resolver.getUriForFile(canonicalUri);
      yield* fsService
        .showTextDocument(targetUri)
        .pipe(Effect.catchTag('FsServiceError', e => Effect.log(`Could not open file: ${String(e)}`)));
    }
  }

  return result;
});

export class OrgBrowserRetrieveService extends Effect.Service<OrgBrowserRetrieveService>()(
  'OrgBrowserRetrieveService',
  {
    accessors: true,
    succeed: {
      /**
       * Retrieve metadata components and optionally open them in the editor
       * @param members - Array of MetadataMember to retrieve
       * @param openInEditor - Whether to open retrieved files in the editor
       * @returns Effect that resolves to the retrieve result
       */
      retrieve
    }
  }
) {}
