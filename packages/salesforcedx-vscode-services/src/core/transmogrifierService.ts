/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SObjectArtifactIdentity } from './artifactIdentity';
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as S from 'effect/Schema';
import type { URI } from 'vscode-uri';
import { SObjectSemanticModelSchema, type SObjectSemanticField, type SObjectSemanticModel } from './artifactProjection';
import { SObjectSchema, type SObject, type SObjectField } from './schemas/sObject';

type RawDescribeSObjectResult = Awaited<ReturnType<Connection['describe']>>;

/** Re-exported raw jsforce describe result for consumer type safety */
export type DescribeSObjectResult = RawDescribeSObjectResult;

export type RestSObjectDescribeTransmogrifierInput = {
  readonly source: 'rest-sobject-describe';
  readonly identity: SObjectArtifactIdentity;
  readonly value: DescribeSObjectResult;
};

export type WorkspaceSObjectMetadataDocument = {
  readonly fullName: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly definitionUri: URI;
};

/** Structured metadata parsed by SDR. Raw XML is never interpreted by the Transmogrifier. */
export type WorkspaceSObjectMetadata = {
  readonly object: WorkspaceSObjectMetadataDocument;
  readonly fields: readonly WorkspaceSObjectMetadataDocument[];
};

export type WorkspaceSObjectMetadataTransmogrifierInput = {
  readonly source: 'workspace-sobject-metadata';
  readonly identity: SObjectArtifactIdentity;
  readonly value: WorkspaceSObjectMetadata;
};

/** Provider-native SObject inputs accepted by the canonical transformation boundary. */
export type TransmogrifierInput = RestSObjectDescribeTransmogrifierInput | WorkspaceSObjectMetadataTransmogrifierInput;

export class TransmogrifierError extends S.TaggedError<TransmogrifierError>()('TransmogrifierError', {
  source: S.Literal('rest-sobject-describe', 'workspace-sobject-metadata'),
  message: S.String,
  cause: S.optional(S.Unknown)
}) {}
const mapToSObject = (raw: RawDescribeSObjectResult): SObject => ({
  name: raw.name,
  label: raw.label,
  custom: raw.custom,
  queryable: raw.queryable,
  fields: (raw.fields ?? []).map(f => ({
    aggregatable: f.aggregatable,
    custom: f.custom,
    defaultValue: f.defaultValue ?? null,
    extraTypeInfo: f.extraTypeInfo ?? null,
    filterable: f.filterable,
    groupable: f.groupable,
    inlineHelpText: f.inlineHelpText ?? null,
    label: f.label,
    length: f.length,
    name: f.name,
    nillable: f.nillable,
    picklistValues: (f.picklistValues ?? []).map(pv => ({
      active: pv.active,
      label: pv.label ?? null,
      value: pv.value
    })),
    precision: f.precision,
    referenceTo: [...(f.referenceTo ?? [])],
    relationshipName: f.relationshipName ?? null,
    scale: f.scale,
    sortable: f.sortable,
    type: f.type
  })),
  childRelationships: (raw.childRelationships ?? []).map(cr => ({
    childSObject: cr.childSObject,
    field: cr.field,
    relationshipName: cr.relationshipName ?? null
  }))
});

const compareName = (left: { readonly name: string }, right: { readonly name: string }): number =>
  left.name < right.name ? -1 : left.name > right.name ? 1 : 0;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const metadataValue = (
  metadata: Readonly<Record<string, unknown>>,
  metadataType: 'CustomObject' | 'CustomField'
): Readonly<Record<string, unknown>> => {
  const wrapped = metadata[metadataType];
  return isRecord(wrapped) ? wrapped : metadata;
};

const asArray = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value];

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const optionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const optionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const workspaceFieldType = (value: unknown): string | undefined => {
  const metadataType = optionalString(value);
  if (!metadataType) return undefined;
  const normalized = metadataType.toLowerCase();
  const typeMap: Readonly<Record<string, string>> = {
    autonumber: 'string',
    checkbox: 'boolean',
    encryptedtext: 'string',
    externallookup: 'reference',
    hierarchy: 'reference',
    html: 'textarea',
    indirectlookup: 'reference',
    longtextarea: 'textarea',
    lookup: 'reference',
    masterdetail: 'reference',
    metadatarelationship: 'reference',
    multiselectpicklist: 'multipicklist',
    number: 'double',
    text: 'string'
  };
  return typeMap[normalized] ?? normalized;
};

const simpleFieldName = (objectName: string, fullName: string): string => {
  const prefix = `${objectName}.`;
  return fullName.toLowerCase().startsWith(prefix.toLowerCase()) ? fullName.slice(prefix.length) : fullName;
};

const workspacePicklistValues = (field: Readonly<Record<string, unknown>>) => {
  const valueSet = isRecord(field.valueSet) ? field.valueSet : undefined;
  const definition = valueSet && isRecord(valueSet.valueSetDefinition) ? valueSet.valueSetDefinition : undefined;
  return asArray(definition?.value)
    .filter(isRecord)
    .flatMap(value => {
      const name = optionalString(value.fullName);
      if (!name) return [];
      const label = optionalString(value.label);
      const active = optionalBoolean(value.isActive);
      return [
        {
          value: name,
          ...(label === undefined ? {} : { label }),
          ...(active === undefined ? {} : { active })
        }
      ];
    })
    .toSorted((left, right) => left.value.localeCompare(right.value));
};

const mapWorkspaceField = (
  identity: SObjectArtifactIdentity,
  document: WorkspaceSObjectMetadataDocument,
  rawField?: Readonly<Record<string, unknown>>
): SObjectSemanticField | undefined => {
  const field = rawField ?? metadataValue(document.metadata, 'CustomField');
  const fullName = optionalString(field.fullName) ?? optionalString(document.fullName);
  if (!fullName) return undefined;
  const name = simpleFieldName(identity.name, fullName);
  const label = optionalString(field.label);
  const type = workspaceFieldType(field.type);
  const defaultValue = field.defaultValue;
  const inlineHelpText = optionalString(field.inlineHelpText);
  const length = optionalNumber(field.length);
  const precision = optionalNumber(field.precision);
  const scale = optionalNumber(field.scale);
  const referenceTo = asArray(field.referenceTo)
    .flatMap(value => optionalString(value) ?? [])
    .toSorted();
  const relationshipName = optionalString(field.relationshipName);
  const picklistValues = workspacePicklistValues(field);
  return {
    name,
    ...(label === undefined ? {} : { label }),
    ...(type === undefined ? {} : { type }),
    custom: /__(?:c|mdt|e|b|x)$/i.test(name),
    ...(defaultValue === undefined ? {} : { defaultValue }),
    ...(inlineHelpText === undefined ? {} : { inlineHelpText }),
    ...(length === undefined ? {} : { length }),
    ...(precision === undefined ? {} : { precision }),
    ...(scale === undefined ? {} : { scale }),
    ...(referenceTo.length === 0 ? {} : { referenceTo }),
    ...(relationshipName === undefined ? {} : { relationshipName }),
    ...(picklistValues.length === 0 ? {} : { picklistValues }),
    definitionUri: document.definitionUri
  };
};

const mapWorkspaceSObjectToSemanticModel = (
  identity: SObjectArtifactIdentity,
  workspace: WorkspaceSObjectMetadata
): SObjectSemanticModel => {
  const object = metadataValue(workspace.object.metadata, 'CustomObject');
  const nameField = isRecord(object.nameField) ? object.nameField : undefined;
  const fields = [
    ...asArray(object.fields)
      .filter(isRecord)
      .map(field => mapWorkspaceField(identity, workspace.object, field)),
    ...(nameField
      ? [
          mapWorkspaceField(identity, workspace.object, {
            ...nameField,
            fullName: 'Name'
          })
        ]
      : []),
    ...workspace.fields.map(document => mapWorkspaceField(identity, document))
  ].reduce(
    (byName, field) => (field ? new Map(byName).set(field.name.toLowerCase(), field) : byName),
    new Map<string, SObjectSemanticField>()
  );

  const label = optionalString(object.label);
  const pluralLabel = optionalString(object.pluralLabel);
  return {
    kind: 'sobject',
    value: {
      identity,
      ...(label === undefined ? {} : { label }),
      ...(pluralLabel === undefined ? {} : { pluralLabel }),
      custom: /__(?:c|mdt|e|b|x)$/i.test(identity.name),
      fields: [...fields.values()].toSorted(compareName),
      definitionUri: workspace.object.definitionUri
    }
  };
};

const mapRestFieldToSemanticField = (field: SObjectField): SObjectSemanticField => ({
  name: field.name,
  label: field.label,
  type: field.type,
  custom: field.custom,
  defaultValue: field.defaultValue,
  ...(field.inlineHelpText === null ? {} : { inlineHelpText: field.inlineHelpText }),
  ...(field.length === undefined ? {} : { length: field.length }),
  ...(field.precision === undefined ? {} : { precision: field.precision }),
  ...(field.scale === undefined ? {} : { scale: field.scale }),
  referenceTo: field.referenceTo.toSorted(),
  ...(field.relationshipName === null ? {} : { relationshipName: field.relationshipName }),
  picklistValues: field.picklistValues
    .map(value => ({
      value: value.value,
      active: value.active,
      ...(value.label === null ? {} : { label: value.label })
    }))
    .toSorted((left, right) => left.value.localeCompare(right.value)),
  runtimeCapabilities: {
    aggregatable: field.aggregatable,
    filterable: field.filterable,
    groupable: field.groupable,
    nillable: field.nillable,
    sortable: field.sortable
  }
});

const mapRestDescribeToSemanticModel = (
  identity: SObjectArtifactIdentity,
  raw: DescribeSObjectResult
): SObjectSemanticModel => {
  const value = mapToSObject(raw);
  return {
    kind: 'sobject',
    value: {
      identity,
      label: value.label,
      custom: value.custom,
      queryable: value.queryable,
      fields: value.fields.map(mapRestFieldToSemanticField).toSorted(compareName),
      childRelationships: value.childRelationships
        .map(relationship => ({
          childSObject: relationship.childSObject,
          field: relationship.field,
          ...(relationship.relationshipName === null ? {} : { relationshipName: relationship.relationshipName })
        }))
        .toSorted((left, right) =>
          left.childSObject === right.childSObject
            ? left.field.localeCompare(right.field)
            : left.childSObject.localeCompare(right.childSObject)
        )
    }
  };
};

export class TransmogrifierService extends Effect.Service<TransmogrifierService>()('TransmogrifierService', {
  accessors: true,
  dependencies: [],
  effect: Effect.gen(function* () {
    const toMinimalSObject = Effect.fn('TransmogrifierService.toMinimalSObject')(function* (
      raw: DescribeSObjectResult
    ) {
      return mapToSObject(raw);
    });

    const decodeSObject = Effect.fn('TransmogrifierService.decodeSObject')(function* (input: unknown) {
      return yield* S.decodeUnknown(SObjectSchema)(input);
    });

    const toSemanticModel = Effect.fn('TransmogrifierService.toSemanticModel')(function* (input: TransmogrifierInput) {
      const model =
        input.source === 'rest-sobject-describe'
          ? mapRestDescribeToSemanticModel(input.identity, input.value)
          : mapWorkspaceSObjectToSemanticModel(input.identity, input.value);
      return yield* S.validate(SObjectSemanticModelSchema)(model).pipe(
        Effect.mapError(
          cause =>
            new TransmogrifierError({
              source: input.source,
              message: `Failed to transform ${input.source} into the canonical semantic model`,
              cause
            })
        )
      );
    });

    return { toMinimalSObject, decodeSObject, toSemanticModel, SObjectSchema };
  })
}) {}
