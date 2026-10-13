/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as HashMap from 'effect/HashMap';
import * as Option from 'effect/Option';
import * as Order from 'effect/Order';
import * as ParseResult from 'effect/ParseResult';
import * as Predicate from 'effect/Predicate';
import { isBoolean, isNotUndefined, isNull, isNullable, isNumber, isString, isUndefined } from 'effect/Predicate';
import * as Record from 'effect/Record';
import * as S from 'effect/Schema';
import type * as AST from 'effect/SchemaAST';
import { URI } from 'vscode-uri';
import {
  artifactIdentitiesEqual,
  SObjectArtifactIdentitySchema,
  type SObjectArtifactIdentity
} from './artifactIdentity';
import { SObjectPicklistValueSchema, SObjectSemanticModelSchema } from './artifactProjection';
import { SObjectSchema } from './schemas/sObject';

type RawDescribeSObjectResult = Awaited<ReturnType<Connection['describe']>>;

export type DescribeSObjectResult = RawDescribeSObjectResult;

export type RestSObjectDescribeTransmogrifierInput = {
  readonly source: 'rest-sobject-describe';
  readonly identity: SObjectArtifactIdentity;
  readonly value: DescribeSObjectResult;
};

type WorkspaceSObjectMetadataDocument = {
  readonly fullName: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly definitionUri: URI;
};

/** Structured metadata parsed by SDR. Raw XML is never interpreted by the Transmogrifier. */
type WorkspaceSObjectMetadata = {
  readonly object: WorkspaceSObjectMetadataDocument;
  readonly fields: readonly WorkspaceSObjectMetadataDocument[];
};

type WorkspaceSObjectMetadataTransmogrifierInput = {
  readonly source: 'workspace-sobject-metadata';
  readonly identity: SObjectArtifactIdentity;
  readonly value: WorkspaceSObjectMetadata;
};

type PersistedSObjectSemanticModelTransmogrifierInput = {
  readonly source: 'persisted-semantic-model';
  readonly identity: SObjectArtifactIdentity;
  readonly value: unknown;
};

/** Provider-native SObject inputs normalized into the canonical semantic model. */
type TransmogrifierInput =
  | RestSObjectDescribeTransmogrifierInput
  | WorkspaceSObjectMetadataTransmogrifierInput
  | PersistedSObjectSemanticModelTransmogrifierInput;

export class TransmogrifierError extends S.TaggedError<TransmogrifierError>()('TransmogrifierError', {
  source: S.Literal('rest-sobject-describe', 'workspace-sobject-metadata', 'persisted-semantic-model'),
  message: S.String,
  cause: S.optional(S.Unknown)
}) {}

type SemanticModelEncoded = S.Schema.Encoded<typeof SObjectSemanticModelSchema>;
type SemanticFieldEncoded = SemanticModelEncoded['value']['fields'][number];
type SObjectDecoded = S.Schema.Type<typeof SObjectSchema>;

const byLocale = Order.make<string>((self, that) => {
  const compared = self.localeCompare(that);
  return compared < 0 ? -1 : compared > 0 ? 1 : 0;
});

const byName = Order.mapInput(Order.string, (value: { readonly name: string }) => value.name);

type ChildRelationshipOrder = { readonly childSObject: string; readonly field: string };

const byChildRelationship = Order.combine<ChildRelationshipOrder>(
  Order.mapInput(byLocale, (value: ChildRelationshipOrder) => value.childSObject),
  Order.mapInput(byLocale, (value: ChildRelationshipOrder) => value.field)
);

const byPicklistValue = Order.mapInput(byLocale, (value: { readonly value: string }) => value.value);

const decodeOnly = (actual: unknown, ast: AST.AST) =>
  Effect.fail(new ParseResult.Forbidden(ast, actual, 'Transmogrifier schemas are decode-only'));

const customApiName = (name: string): boolean => /__(?:c|mdt|e|b|x)$/i.test(name);

const metadataRecord = S.declare(Predicate.isRecord, { identifier: 'MetadataRecord' });

const unwrapMetadata = (metadataType: 'CustomObject' | 'CustomField') =>
  S.transform(metadataRecord, metadataRecord, {
    strict: true,
    decode: metadata => {
      const wrapped = metadata[metadataType];
      return S.is(metadataRecord)(wrapped) ? wrapped : metadata;
    },
    encode: metadata => metadata
  });

const UriSchema = S.declare((value): value is URI => URI.isUri(value), {
  identifier: 'URI',
  description: 'vscode-uri URI'
});

const workspaceDocument = (metadataType: 'CustomObject' | 'CustomField') =>
  S.Struct({
    fullName: S.String,
    metadata: unwrapMetadata(metadataType),
    definitionUri: UriSchema
  });

const unknownArray = S.transform(S.Unknown, S.Array(S.Unknown), {
  strict: true,
  decode: value => (Array.isArray(value) ? value : isUndefined(value) ? [] : [value]),
  encode: value => value
});

const optionalTrimmedString = pipe(
  S.transform(S.Unknown, S.String.pipe(S.UndefinedOr), {
    strict: true,
    decode: value => (isString(value) ? value : undefined),
    encode: value => value
  }),
  S.compose(S.OptionFromNonEmptyTrimmedString.pipe(S.UndefinedOr)),
  S.compose(
    S.transform(
      S.NonEmptyTrimmedString.pipe(S.OptionFromSelf, S.UndefinedOr),
      S.NonEmptyTrimmedString.pipe(S.UndefinedOr),
      {
        strict: true,
        decode: value => (isUndefined(value) ? undefined : Option.getOrUndefined(value)),
        encode: value => (isUndefined(value) ? undefined : Option.some(value))
      }
    )
  )
);

const optionalFiniteNumber = S.transform(S.Unknown, S.UndefinedOr(S.Number), {
  strict: true,
  decode: value => {
    const parsed = isString(value) ? Number(value) : undefined;
    return isNumber(value) && Number.isFinite(value)
      ? value
      : isString(value) && value.trim().length > 0 && Number.isFinite(parsed)
        ? parsed
        : undefined;
  },
  encode: value => value
});

const optionalBoolean = S.transform(S.Unknown, S.UndefinedOr(S.Boolean), {
  strict: true,
  decode: value => (isBoolean(value) ? value : value === 'true' ? true : value === 'false' ? false : undefined),
  encode: value => value
});

const workspaceFieldTypeByMetadata: Readonly<Record<string, string>> = {
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

const workspaceFieldType = pipe(
  optionalTrimmedString,
  S.compose(
    S.transform(S.NonEmptyTrimmedString.pipe(S.UndefinedOr), S.String.pipe(S.UndefinedOr), {
      strict: true,
      decode: value =>
        isUndefined(value) ? undefined : (workspaceFieldTypeByMetadata[value.toLowerCase()] ?? value.toLowerCase()),
      encode: value => value
    })
  )
);

const workspaceReferenceTo = pipe(
  unknownArray,
  S.compose(S.Array(optionalTrimmedString)),
  S.compose(
    S.transform(S.Array(S.NonEmptyTrimmedString.pipe(S.UndefinedOr)), S.Array(S.String), {
      strict: true,
      decode: items => pipe(items, Arr.filter(isNotUndefined), Arr.sort(Order.string)),
      encode: value => value
    })
  )
);

const WorkspacePicklistEntrySchema = S.Struct({
  fullName: S.optional(optionalTrimmedString),
  label: S.optional(optionalTrimmedString),
  isActive: S.optional(optionalBoolean)
});

const workspacePicklistValues = S.transform(S.Unknown, S.Array(SObjectPicklistValueSchema), {
  strict: true,
  decode: valueSet => {
    const valueSetRecord = S.is(metadataRecord)(valueSet) ? valueSet : undefined;
    const definition =
      isUndefined(valueSetRecord) || !S.is(metadataRecord)(valueSetRecord.valueSetDefinition)
        ? undefined
        : valueSetRecord.valueSetDefinition;
    return pipe(
      S.decodeUnknownSync(unknownArray)(isUndefined(definition) ? undefined : definition.value),
      Arr.flatMap(item => {
        if (!S.is(metadataRecord)(item)) return [];
        const { fullName: name, label, isActive: active } = S.decodeUnknownSync(WorkspacePicklistEntrySchema)(item);
        return isUndefined(name) ? [] : [{ value: name, ...Record.filter({ label, active }, isNotUndefined) }];
      }),
      Arr.sort(byPicklistValue)
    );
  },
  encode: value => value
});

const WorkspaceFieldMetadataSchema = S.Struct({
  fullName: S.optional(optionalTrimmedString),
  label: S.optional(optionalTrimmedString),
  type: S.optional(workspaceFieldType),
  inlineHelpText: S.optional(optionalTrimmedString),
  length: S.optional(optionalFiniteNumber),
  precision: S.optional(optionalFiniteNumber),
  scale: S.optional(optionalFiniteNumber),
  relationshipName: S.optional(optionalTrimmedString),
  referenceTo: S.optionalWith(workspaceReferenceTo, { default: () => [] }),
  valueSet: S.optionalWith(workspacePicklistValues, { default: () => [] }),
  defaultValue: S.optional(S.Unknown)
});

const WorkspaceObjectMetadataSchema = S.Struct({
  label: S.optional(optionalTrimmedString),
  pluralLabel: S.optional(optionalTrimmedString),
  nameField: S.optional(S.Unknown),
  fields: S.optionalWith(unknownArray, { default: () => [] })
});

const nullableString = () => S.optionalWith(S.NullOr(S.String), { default: () => null });
const optionalNullOrNumber = S.Number.pipe(S.NullOr, S.optional);

const RestPicklistValueSchema = S.Struct({
  active: S.Boolean,
  label: nullableString(),
  value: S.String
});

const RestFieldSchema = S.Struct({
  aggregatable: S.Boolean,
  custom: S.Boolean,
  defaultValue: S.optionalWith(S.Unknown, { default: () => null }),
  extraTypeInfo: nullableString(),
  filterable: S.Boolean,
  groupable: S.Boolean,
  inlineHelpText: nullableString(),
  label: S.String,
  length: optionalNullOrNumber,
  name: S.String,
  nillable: S.Boolean,
  picklistValues: S.optionalWith(S.Array(RestPicklistValueSchema), { default: () => [], nullable: true }),
  precision: optionalNullOrNumber,
  referenceTo: S.optionalWith(S.Array(S.String), { default: () => [], nullable: true }),
  relationshipName: nullableString(),
  scale: optionalNullOrNumber,
  sortable: S.Boolean,
  type: S.String
});

const RestChildRelationshipSchema = S.Struct({
  childSObject: S.String,
  field: S.String,
  relationshipName: nullableString()
});

const RestDescribeSchema = S.Struct({
  name: S.String,
  label: S.String,
  custom: S.Boolean,
  queryable: S.Boolean,
  fields: S.optionalWith(S.Array(RestFieldSchema), { default: () => [], nullable: true }),
  childRelationships: S.optionalWith(S.Array(RestChildRelationshipSchema), { default: () => [], nullable: true })
});

const RestDescribeToSObject = S.transformOrFail(RestDescribeSchema, SObjectSchema, {
  strict: true,
  decode: raw =>
    Effect.succeed({
      name: raw.name,
      label: raw.label,
      custom: raw.custom,
      queryable: raw.queryable,
      fields: raw.fields.map(field => ({
        aggregatable: field.aggregatable,
        custom: field.custom,
        defaultValue: field.defaultValue,
        extraTypeInfo: field.extraTypeInfo,
        filterable: field.filterable,
        groupable: field.groupable,
        inlineHelpText: field.inlineHelpText,
        label: field.label,
        ...(isNullable(field.length) ? {} : { length: field.length }),
        name: field.name,
        nillable: field.nillable,
        picklistValues: field.picklistValues.map(picklistValue => ({
          active: picklistValue.active,
          label: picklistValue.label,
          value: picklistValue.value
        })),
        ...(isNullable(field.precision) ? {} : { precision: field.precision }),
        referenceTo: [...field.referenceTo],
        relationshipName: field.relationshipName,
        ...(isNullable(field.scale) ? {} : { scale: field.scale }),
        sortable: field.sortable,
        type: field.type
      })),
      childRelationships: raw.childRelationships.map(relationship => ({
        childSObject: relationship.childSObject,
        field: relationship.field,
        relationshipName: relationship.relationshipName
      }))
    }),
  encode: (toI, _options, ast) => decodeOnly(toI, ast)
});

const restSemanticField = (field: SObjectDecoded['fields'][number]): SemanticFieldEncoded => ({
  name: field.name,
  label: field.label,
  type: field.type,
  custom: field.custom,
  defaultValue: field.defaultValue,
  ...(isNull(field.inlineHelpText) ? {} : { inlineHelpText: field.inlineHelpText }),
  ...(isUndefined(field.length) ? {} : { length: field.length }),
  ...(isUndefined(field.precision) ? {} : { precision: field.precision }),
  ...(isUndefined(field.scale) ? {} : { scale: field.scale }),
  referenceTo: Arr.sort(field.referenceTo, Order.string),
  ...(isNull(field.relationshipName) ? {} : { relationshipName: field.relationshipName }),
  picklistValues: Arr.sort(
    field.picklistValues.map(value => ({
      value: value.value,
      active: value.active,
      ...(isNull(value.label) ? {} : { label: value.label })
    })),
    byPicklistValue
  ),
  runtimeCapabilities: {
    aggregatable: field.aggregatable,
    filterable: field.filterable,
    groupable: field.groupable,
    nillable: field.nillable,
    sortable: field.sortable
  }
});

const restSemanticChild = (
  relationship: SObjectDecoded['childRelationships'][number]
): NonNullable<SemanticModelEncoded['value']['childRelationships']>[number] => ({
  childSObject: relationship.childSObject,
  field: relationship.field,
  ...(isNull(relationship.relationshipName) ? {} : { relationshipName: relationship.relationshipName })
});

const restSemanticEncoded = (
  identity: S.Schema.Type<typeof SObjectArtifactIdentitySchema>,
  sobject: SObjectDecoded
): SemanticModelEncoded => ({
  kind: 'sobject',
  value: {
    identity,
    label: sobject.label,
    custom: sobject.custom,
    queryable: sobject.queryable,
    fields: Arr.sort(sobject.fields.map(restSemanticField), byName),
    childRelationships: Arr.sort(sobject.childRelationships.map(restSemanticChild), byChildRelationship)
  }
});

const RestSemanticInput = S.Struct({
  source: S.Literal('rest-sobject-describe'),
  identity: SObjectArtifactIdentitySchema,
  value: S.Unknown
});

const RestDescribeToSemanticModel = S.transformOrFail(RestSemanticInput, SObjectSemanticModelSchema, {
  strict: true,
  decode: input =>
    S.decodeUnknown(RestDescribeToSObject)(input.value).pipe(
      Effect.mapError(error => error.issue),
      Effect.map(sobject => restSemanticEncoded(input.identity, sobject))
    ),
  encode: (toI, _options, ast) => decodeOnly(toI, ast)
});

const simpleFieldName = (objectName: string, fullName: string): string => {
  const prefix = `${objectName}.`;
  return fullName.toLowerCase().startsWith(prefix.toLowerCase()) ? fullName.slice(prefix.length) : fullName;
};

const workspaceSemanticField = (
  objectName: string,
  documentFullName: string,
  definitionUri: URI,
  field: Readonly<Record<string, unknown>>
) => {
  const decoded = S.decodeUnknownSync(WorkspaceFieldMetadataSchema)(field);
  const fullName = decoded.fullName ?? S.decodeUnknownSync(optionalTrimmedString)(documentFullName);
  if (isUndefined(fullName)) return Option.none();
  const name = simpleFieldName(objectName, fullName);
  const {
    label,
    type,
    inlineHelpText,
    length,
    precision,
    scale,
    relationshipName,
    referenceTo,
    valueSet: picklistValues,
    defaultValue
  } = decoded;
  return Option.some({
    name,
    custom: customApiName(name),
    definitionUri,
    ...Record.filter(
      {
        label,
        type,
        defaultValue,
        inlineHelpText,
        length,
        precision,
        scale,
        relationshipName,
        referenceTo: referenceTo.length === 0 ? undefined : referenceTo,
        picklistValues: picklistValues.length === 0 ? undefined : picklistValues
      },
      isNotUndefined
    )
  });
};

const byLowerName = <A extends { readonly name: string }>(fields: readonly A[]): readonly A[] =>
  pipe(
    fields,
    Arr.reduce(HashMap.empty<string, A>(), (names, field) => HashMap.set(names, field.name.toLowerCase(), field)),
    HashMap.toValues,
    Arr.sort(byName)
  );

const WorkspaceSemanticInput = S.Struct({
  source: S.Literal('workspace-sobject-metadata'),
  identity: SObjectArtifactIdentitySchema,
  value: S.Struct({
    object: workspaceDocument('CustomObject'),
    fields: S.Array(workspaceDocument('CustomField'))
  })
});

const workspaceSemanticEncoded = (input: S.Schema.Type<typeof WorkspaceSemanticInput>) => {
  const objectName = input.identity.name;
  const objectUri = input.value.object.definitionUri;
  const {
    label,
    pluralLabel,
    nameField: rawNameField,
    fields: objectFields
  } = S.decodeUnknownSync(WorkspaceObjectMetadataSchema)(input.value.object.metadata);
  const nameField = S.is(metadataRecord)(rawNameField) ? { ...rawNameField, fullName: 'Name' } : undefined;
  const sources = [
    ...pipe(
      objectFields,
      Arr.flatMap(item => (S.is(metadataRecord)(item) ? [item] : []))
    ).map(field => ({
      documentFullName: input.value.object.fullName,
      definitionUri: objectUri,
      field
    })),
    ...(isUndefined(nameField)
      ? []
      : [{ documentFullName: input.value.object.fullName, definitionUri: objectUri, field: nameField }]),
    ...input.value.fields.map(document => ({
      documentFullName: document.fullName,
      definitionUri: document.definitionUri,
      field: document.metadata
    }))
  ];
  return {
    kind: 'sobject',
    value: {
      identity: input.identity,
      custom: customApiName(objectName),
      fields: byLowerName(
        Arr.filterMap(sources, source =>
          workspaceSemanticField(objectName, source.documentFullName, source.definitionUri, source.field)
        )
      ),
      definitionUri: objectUri,
      ...Record.filter({ label, pluralLabel }, isNotUndefined)
    }
  };
};

// typeSchema: definitionUri is already a URI. The encoded schema would parse toString() into a new instance.
const WorkspaceMetadataToSemanticModel = S.transformOrFail(
  WorkspaceSemanticInput,
  S.typeSchema(SObjectSemanticModelSchema),
  {
    strict: false,
    decode: input => Effect.succeed(workspaceSemanticEncoded(input)),
    encode: (toI, _options, ast) => decodeOnly(toI, ast)
  }
);

const SemanticModelFromTransmogrifierInput = S.Union(RestDescribeToSemanticModel, WorkspaceMetadataToSemanticModel);

export class TransmogrifierService extends Effect.Service<TransmogrifierService>()('TransmogrifierService', {
  accessors: true,
  dependencies: [],
  effect: Effect.gen(function* () {
    const toMinimalSObject = Effect.fn('TransmogrifierService.toMinimalSObject')((raw: DescribeSObjectResult) =>
      S.decodeUnknown(RestDescribeToSObject)(raw)
    );

    const decodeSObject = Effect.fn('TransmogrifierService.decodeSObject')(function* (input: unknown) {
      return yield* S.decodeUnknown(SObjectSchema)(input);
    });

    const toSemanticModel = Effect.fn('TransmogrifierService.toSemanticModel')(function* (input: TransmogrifierInput) {
      if (input.source === 'persisted-semantic-model') {
        const persistedModel = yield* S.decodeUnknown(SObjectSemanticModelSchema)(input.value).pipe(
          Effect.catchTag('ParseError', cause =>
            Effect.fail(
              new TransmogrifierError({
                source: input.source,
                message: 'Failed to validate the persisted canonical semantic model',
                cause
              })
            )
          )
        );
        if (!artifactIdentitiesEqual(input.identity, persistedModel.value.identity)) {
          return yield* new TransmogrifierError({
            source: input.source,
            message: 'Persisted semantic model identity does not match the requested artifact identity',
            cause: { requested: input.identity, received: persistedModel.value.identity }
          });
        }
        return persistedModel;
      }
      return yield* S.decodeUnknown(SemanticModelFromTransmogrifierInput)(input).pipe(
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
