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
import { MetadataRegistryService } from './metadataRegistryService.js';

export const ORG_METADATA_SCHEME = 'sf-org-metadata';
// URI locations use path-safe IDs; cloud operations separately require canonical OrgId.
const PathSafeOrgId = Schema.NonEmptyString.pipe(Schema.check(Schema.isPattern(/^[A-Za-z0-9_-]+$/)));
export const OrgMetadataReference = Schema.Struct({
  xmlName: Schema.optional(Schema.String),
  fullName: Schema.optional(Schema.String)
});
export type OrgMetadataReference = typeof OrgMetadataReference.Type;
export const OrgMetadataComponentReference = Schema.Struct({
  xmlName: Schema.NonEmptyString,
  fullName: Schema.NonEmptyString
});
export type OrgMetadataComponentReference = typeof OrgMetadataComponentReference.Type;
export const OrgMetadataDocumentLocation = Schema.Struct({
  ...OrgMetadataComponentReference.fields,
  orgId: PathSafeOrgId
});
export type OrgMetadataDocumentLocation = typeof OrgMetadataDocumentLocation.Type;
export const isOrgMetadataComponentReference = Schema.is(OrgMetadataComponentReference);

const extensionForSuffix = (suffix: string | undefined) => (suffix ? `.${suffix}` : undefined);
const makeDocumentUri = (location: OrgMetadataDocumentLocation, extension: string | undefined): URI => {
  Schema.decodeUnknownSync(OrgMetadataDocumentLocation)(location);
  const segments = location.fullName.split('/');
  const last = segments.at(-1);
  if (last) segments[segments.length - 1] = `${last}${extension ?? ''}`;
  return URI.from({
    scheme: ORG_METADATA_SCHEME,
    path: `/orgs/${location.orgId}/${location.xmlName}/${segments.join('/')}`
  });
};
/** URI location parser only; no registry/workspace lookup or cloud identity assertion. */
export const orgIdFromOrgMetadataUri = (uri: URI): string | undefined => {
  if (uri.scheme !== ORG_METADATA_SCHEME) return undefined;
  const [, root, orgId] = uri.path.split('/');
  return root === 'orgs' && Schema.is(PathSafeOrgId)(orgId) ? orgId : undefined;
};
const parsePath = (uri: URI, extension: string | undefined): OrgMetadataDocumentLocation | undefined => {
  if (uri.scheme !== ORG_METADATA_SCHEME) return undefined;
  const [, root, orgId, xmlName, ...name] = uri.path.split('/');
  if (root !== 'orgs' || !orgId || !xmlName || name.length === 0) return undefined;
  const last = name.at(-1);
  if (!last || (extension && !last.endsWith(extension))) return undefined;
  name[name.length - 1] = extension ? last.slice(0, -extension.length) : last;
  const location = { orgId, xmlName, fullName: name.join('/') };
  return Schema.is(OrgMetadataDocumentLocation)(location) ? location : undefined;
};
export const getTypeSuffix = Effect.fn('OrgMetadataReferenceService.typeSuffix')(function* (xmlName: string) {
  const access = yield* MetadataRegistryService.use(service => service.getRegistryAccess());
  return Option.getOrUndefined(Option.liftThrowable(() => access.getTypeByName(xmlName).suffix)());
});
export const documentUris = Effect.fn('OrgMetadataReferenceService.documentUris')(function* (
  locations: readonly OrgMetadataDocumentLocation[]
) {
  const suffixes = yield* Effect.forEach(new Set(locations.map(location => location.xmlName)), xmlName =>
    getTypeSuffix(xmlName).pipe(Effect.map(suffix => [xmlName, extensionForSuffix(suffix)] as const))
  );
  const byType = new Map(suffixes);
  return locations.map(location => makeDocumentUri(location, byType.get(location.xmlName)));
});
export const documentUri = Effect.fn('OrgMetadataReferenceService.documentUri')(function* (
  location: OrgMetadataDocumentLocation
) {
  return makeDocumentUri(location, extensionForSuffix(yield* getTypeSuffix(location.xmlName)));
});
export const parseDocumentUri = Effect.fn('OrgMetadataReferenceService.parseDocumentUri')(function* (uri: URI) {
  if (uri.scheme !== ORG_METADATA_SCHEME) return undefined;
  const [, root, orgId, xmlName] = uri.path.split('/');
  if (root !== 'orgs' || !orgId || !xmlName) return undefined;
  return parsePath(uri, extensionForSuffix(yield* getTypeSuffix(xmlName)));
});
