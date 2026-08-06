/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { RegistryAccess } from '@salesforce/source-deploy-retrieve';
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

const documentExtension = (registryAccess: RegistryAccess, xmlName: string): string | undefined => {
  const metadataType = Option.getOrUndefined(Option.liftThrowable(() => registryAccess.getTypeByName(xmlName))());
  return metadataType?.suffix ? `.${metadataType.suffix}` : undefined;
};

const pathSegments = (value: string): string[] => value.split('/');

const makeDocumentUri = (
  registryAccess: RegistryAccess,
  { orgId, xmlName, fullName }: OrgMetadataDocumentLocation
): URI => {
  Schema.decodeUnknownSync(OrgMetadataDocumentLocation)({ orgId, xmlName, fullName });
  const segments = pathSegments(fullName);
  const finalSegment = segments.at(-1);
  const extension = documentExtension(registryAccess, xmlName);
  if (finalSegment) {
    segments[segments.length - 1] = `${finalSegment}${extension ?? ''}`;
  }
  return URI.from({
    scheme: ORG_METADATA_SCHEME,
    path: `/orgs/${orgId}/${xmlName}/${segments.join('/')}`
  });
};

const parseDocumentUri = (registryAccess: RegistryAccess, uri: URI): OrgMetadataDocumentLocation | undefined => {
  if (uri.scheme !== ORG_METADATA_SCHEME) return undefined;
  const [, root, encodedOrgId, encodedXmlName, ...encodedFullName] = uri.path.split('/');
  if (root !== 'orgs' || !encodedOrgId || !encodedXmlName || encodedFullName.length === 0) return undefined;
  const xmlName = encodedXmlName;
  const extension = documentExtension(registryAccess, xmlName);
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
    accessors: true,
    dependencies: [MetadataRegistryService.Default],
    effect: Effect.gen(function* () {
      const registryAccess = yield* MetadataRegistryService.getRegistryAccess();
      return {
        documentUri: (location: OrgMetadataDocumentLocation): URI => makeDocumentUri(registryAccess, location),
        parseDocumentUri: (uri: URI): OrgMetadataDocumentLocation | undefined => parseDocumentUri(registryAccess, uri),
        getTypeSuffix: (xmlName: string): string | undefined =>
          Option.getOrUndefined(Option.liftThrowable(() => registryAccess.getTypeByName(xmlName).suffix)())
      } as const;
    })
  }
) {}
