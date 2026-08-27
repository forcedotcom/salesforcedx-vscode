/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { URI } from 'vscode-uri';
import { MetadataRegistryService } from '../core/metadataRegistryService';

export const ORG_METADATA_SCHEME = 'sf-org-metadata';

const NonEmptyString = Schema.String.pipe(Schema.minLength(1));
const PathSafeOrgId = NonEmptyString.pipe(Schema.pattern(/^[A-Za-z0-9_-]+$/));

export const OrgMetadataReference = Schema.Struct({
  xmlName: Schema.optional(Schema.String),
  fullName: Schema.optional(Schema.String)
});
export type OrgMetadataReference = typeof OrgMetadataReference.Type;

export const OrgMetadataComponentReference = Schema.Struct({
  xmlName: NonEmptyString,
  fullName: NonEmptyString
});
export type OrgMetadataComponentReference = typeof OrgMetadataComponentReference.Type;

export const OrgMetadataDocumentLocation = Schema.Struct({
  ...OrgMetadataComponentReference.fields,
  orgId: PathSafeOrgId
});
export type OrgMetadataDocumentLocation = typeof OrgMetadataDocumentLocation.Type;

const pathSegments = (value: string): string[] => value.split('/');

const suffixToExtension = (suffix: string | undefined): string | undefined => (suffix ? `.${suffix}` : undefined);

const makeDocumentUri = (
  { orgId, xmlName, fullName }: OrgMetadataDocumentLocation,
  extension: string | undefined
): URI => {
  Schema.decodeUnknownSync(OrgMetadataDocumentLocation)({ orgId, xmlName, fullName });
  const segments = pathSegments(fullName);
  const finalSegment = segments.at(-1);
  if (finalSegment) {
    segments[segments.length - 1] = `${finalSegment}${extension ?? ''}`;
  }
  return URI.from({
    scheme: ORG_METADATA_SCHEME,
    path: `/orgs/${orgId}/${xmlName}/${segments.join('/')}`
  });
};

const parseDocumentUriFromPath = (uri: URI, extension: string | undefined): OrgMetadataDocumentLocation | undefined => {
  if (uri.scheme !== ORG_METADATA_SCHEME) return undefined;
  const [, root, encodedOrgId, encodedXmlName, ...encodedFullName] = uri.path.split('/');
  if (root !== 'orgs' || !encodedOrgId || !encodedXmlName || encodedFullName.length === 0) return undefined;
  const xmlName = encodedXmlName;
  const finalSegment = encodedFullName.at(-1);
  if (!finalSegment || (extension && !finalSegment.endsWith(extension))) return undefined;
  const fullNameSegments = [...encodedFullName];
  fullNameSegments[fullNameSegments.length - 1] = extension ? finalSegment.slice(0, -extension.length) : finalSegment;
  const location = {
    orgId: encodedOrgId,
    xmlName,
    fullName: fullNameSegments.join('/')
  };
  return Schema.is(OrgMetadataDocumentLocation)(location) ? location : undefined;
};

export const isOrgMetadataComponentReference = Schema.is(OrgMetadataComponentReference);

export class OrgMetadataReferenceService extends Effect.Service<OrgMetadataReferenceService>()(
  'OrgMetadataReferenceService',
  {
    accessors: false,
    dependencies: [MetadataRegistryService.Default],
    effect: Effect.gen(function* () {
      const metadataRegistryService = yield* MetadataRegistryService;
      const typeSuffix = Effect.fn('OrgMetadataReferenceService.typeSuffix')((xmlName: string) =>
        metadataRegistryService
          .getRegistryAccess()
          .pipe(
            Effect.map(access =>
              Option.getOrUndefined(Option.liftThrowable(() => access.getTypeByName(xmlName).suffix)())
            )
          )
      );

      return {
        documentUri: Effect.fn('OrgMetadataReferenceService.documentUri')(function* (
          location: OrgMetadataDocumentLocation
        ) {
          return makeDocumentUri(location, suffixToExtension(yield* typeSuffix(location.xmlName)));
        }),
        parseDocumentUri: Effect.fn('OrgMetadataReferenceService.parseDocumentUri')(function* (uri: URI) {
          if (uri.scheme !== ORG_METADATA_SCHEME) return undefined;
          const [, root, encodedOrgId, encodedXmlName] = uri.path.split('/');
          if (root !== 'orgs' || !encodedOrgId || !encodedXmlName) return undefined;
          return parseDocumentUriFromPath(uri, suffixToExtension(yield* typeSuffix(encodedXmlName)));
        }),
        getTypeSuffix: typeSuffix
      } as const;
    })
  }
) {}
