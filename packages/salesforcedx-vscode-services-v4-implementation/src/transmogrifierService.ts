/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  NonEmptyTrimmedString,
  SObjectArtifactIdentitySchema,
  SObjectPicklistValueSchema,
  SObjectSchema,
  SObjectSemanticModelSchema,
  TransmogrifierError,
  TransmogrifierService,
  UriSchema,
  artifactIdentitiesEqual,
  type DescribeSObjectResult,
  type SObject,
  type TransmogrifierInput
} from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as HashMap from 'effect/HashMap';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Order from 'effect/Order';
import { isBoolean, isNotUndefined, isNull, isNullish, isNumber, isString, isUndefined } from 'effect/Predicate';
import * as Rec from 'effect/Record';
import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';
import type { URI } from 'vscode-uri';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';

type SemanticEncoded = typeof SObjectSemanticModelSchema.Encoded;
type SemanticField = SemanticEncoded['value']['fields'][number];
const byLocale = Order.make<string>((left, right) => {
  const result = left.localeCompare(right);
  return result < 0 ? -1 : result > 0 ? 1 : 0;
});
const byName = Order.mapInput(Order.String, (value: { readonly name: string }) => value.name);
const byPicklist = Order.mapInput(byLocale, (value: { readonly value: string }) => value.value);
type ChildRelationshipOrder = { readonly childSObject: string; readonly field: string };
const byChild = Order.combine(
  Order.mapInput(byLocale, (value: ChildRelationshipOrder) => value.childSObject),
  Order.mapInput(byLocale, (value: ChildRelationshipOrder) => value.field)
);
const customApiName = (value: string) => /__(?:c|mdt|e|b|x)$/i.test(value);
const metadataRecord = Schema.Record(Schema.String, Schema.Unknown);
const unwrapMetadata = (kind: 'CustomObject' | 'CustomField') =>
  metadataRecord.pipe(
    Schema.decodeTo(metadataRecord, {
      decode: SchemaGetter.transform(value => (Schema.is(metadataRecord)(value[kind]) ? value[kind] : value)),
      encode: SchemaGetter.transform(value => value)
    })
  );
const workspaceDocument = (kind: 'CustomObject' | 'CustomField') =>
  Schema.Struct({ fullName: Schema.String, metadata: unwrapMetadata(kind), definitionUri: Schema.toType(UriSchema) });
const unknownArray = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.Array(Schema.Unknown), {
    decode: SchemaGetter.transform((value): readonly unknown[] =>
      Array.isArray(value) ? value : isUndefined(value) ? [] : [value]
    ),
    encode: SchemaGetter.transform(value => value)
  })
);
const optionalTrimmedString = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.UndefinedOr(NonEmptyTrimmedString), {
    decode: SchemaGetter.transform(value => (isString(value) && value.trim().length > 0 ? value.trim() : undefined)),
    encode: SchemaGetter.transform(value => value)
  })
);
const optionalFiniteNumber = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.UndefinedOr(Schema.Number), {
    decode: SchemaGetter.transform(value => {
      const parsed = isString(value) ? Number(value) : undefined;
      return isNumber(value) && Number.isFinite(value)
        ? value
        : isString(value) && value.trim().length > 0 && Number.isFinite(parsed)
          ? parsed
          : undefined;
    }),
    encode: SchemaGetter.transform(value => value)
  })
);
const optionalBoolean = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.UndefinedOr(Schema.Boolean), {
    decode: SchemaGetter.transform(value =>
      isBoolean(value) ? value : value === 'true' ? true : value === 'false' ? false : undefined
    ),
    encode: SchemaGetter.transform(value => value)
  })
);
const workspaceTypeByMetadata: Readonly<Record<string, string>> = {
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
const workspaceFieldType = optionalTrimmedString.pipe(
  Schema.decodeTo(Schema.UndefinedOr(Schema.String), {
    decode: SchemaGetter.transform(value =>
      isUndefined(value)
        ? undefined
        : Option.getOrElse(Rec.get(workspaceTypeByMetadata, value.toLowerCase()), () => value.toLowerCase())
    ),
    encode: SchemaGetter.transform(value => value)
  })
);
const workspaceReferenceTo = unknownArray.pipe(
  Schema.decodeTo(Schema.Array(Schema.String), {
    decode: SchemaGetter.transform(items =>
      Schema.decodeUnknownSync(Schema.Array(optionalTrimmedString))(items).filter(isNotUndefined).toSorted(Order.String)
    ),
    encode: SchemaGetter.transform(value => value)
  })
);
const WorkspacePicklistEntry = Schema.Struct({
  fullName: Schema.optional(optionalTrimmedString),
  label: Schema.optional(optionalTrimmedString),
  isActive: Schema.optional(optionalBoolean)
});
const workspacePicklistValues = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.Array(SObjectPicklistValueSchema), {
    decode: SchemaGetter.transform(valueSet => {
      const record = Schema.is(metadataRecord)(valueSet) ? valueSet : undefined;
      const definition =
        record && Schema.is(metadataRecord)(record.valueSetDefinition) ? record.valueSetDefinition : undefined;
      return Schema.decodeUnknownSync(unknownArray)(definition?.value)
        .flatMap(item => {
          if (!Schema.is(metadataRecord)(item)) return [];
          const { fullName: name, label, isActive: active } = Schema.decodeUnknownSync(WorkspacePicklistEntry)(item);
          return isUndefined(name) ? [] : [{ value: name, ...Rec.filter({ label, active }, isNotUndefined) }];
        })
        .toSorted(byPicklist);
    }),
    encode: SchemaGetter.transform(value => value)
  })
);
const WorkspaceFieldMetadata = Schema.Struct({
  fullName: Schema.optional(optionalTrimmedString),
  label: Schema.optional(optionalTrimmedString),
  type: Schema.optional(workspaceFieldType),
  inlineHelpText: Schema.optional(optionalTrimmedString),
  length: Schema.optional(optionalFiniteNumber),
  precision: Schema.optional(optionalFiniteNumber),
  scale: Schema.optional(optionalFiniteNumber),
  relationshipName: Schema.optional(optionalTrimmedString),
  referenceTo: workspaceReferenceTo.pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  valueSet: workspacePicklistValues.pipe(Schema.withDecodingDefault(Effect.succeed([]))),
  defaultValue: Schema.optional(Schema.Unknown)
});
const WorkspaceObjectMetadata = Schema.Struct({
  label: Schema.optional(optionalTrimmedString),
  pluralLabel: Schema.optional(optionalTrimmedString),
  nameField: Schema.optional(Schema.Unknown),
  fields: unknownArray.pipe(Schema.withDecodingDefault(Effect.succeed([])))
});
const nullableString = Schema.NullOr(Schema.String).pipe(Schema.withDecodingDefault(Effect.succeed(null)));
const nullableArray = <S extends Schema.Constraint>(schema: S) =>
  Schema.NullOr(Schema.Array(schema)).pipe(
    Schema.decodeTo(Schema.Array(Schema.toType(schema)), {
      decode: SchemaGetter.transform(value => value ?? []),
      encode: SchemaGetter.transform(value => value)
    }),
    Schema.withDecodingDefault(Effect.succeed([]))
  );
const RestPicklist = Schema.Struct({ active: Schema.Boolean, label: nullableString, value: Schema.String });
const RestField = Schema.Struct({
  aggregatable: Schema.Boolean,
  custom: Schema.Boolean,
  defaultValue: Schema.Unknown.pipe(Schema.withDecodingDefault(Effect.succeed(null))),
  extraTypeInfo: nullableString,
  filterable: Schema.Boolean,
  groupable: Schema.Boolean,
  inlineHelpText: nullableString,
  label: Schema.String,
  length: Schema.Number.pipe(Schema.NullOr, Schema.optional),
  name: Schema.String,
  nillable: Schema.Boolean,
  picklistValues: nullableArray(RestPicklist),
  precision: Schema.Number.pipe(Schema.NullOr, Schema.optional),
  referenceTo: nullableArray(Schema.String),
  relationshipName: nullableString,
  scale: Schema.Number.pipe(Schema.NullOr, Schema.optional),
  sortable: Schema.Boolean,
  type: Schema.String
});
const RestChild = Schema.Struct({
  childSObject: Schema.String,
  field: Schema.String,
  relationshipName: nullableString
});
const RestDescribe = Schema.Struct({
  name: Schema.String,
  label: Schema.String,
  custom: Schema.Boolean,
  queryable: Schema.Boolean,
  fields: nullableArray(RestField),
  childRelationships: nullableArray(RestChild)
});
const decodeMinimal = (raw: unknown) =>
  Schema.decodeUnknownEffect(RestDescribe)(raw).pipe(
    Effect.map(value => ({
      name: value.name,
      label: value.label,
      custom: value.custom,
      queryable: value.queryable,
      fields: value.fields.map(field => ({
        aggregatable: field.aggregatable,
        custom: field.custom,
        defaultValue: field.defaultValue,
        extraTypeInfo: field.extraTypeInfo,
        filterable: field.filterable,
        groupable: field.groupable,
        inlineHelpText: field.inlineHelpText,
        label: field.label,
        ...(isNullish(field.length) ? {} : { length: field.length }),
        name: field.name,
        nillable: field.nillable,
        picklistValues: field.picklistValues.map(item => ({
          active: item.active,
          label: item.label,
          value: item.value
        })),
        ...(isNullish(field.precision) ? {} : { precision: field.precision }),
        referenceTo: [...field.referenceTo],
        relationshipName: field.relationshipName,
        ...(isNullish(field.scale) ? {} : { scale: field.scale }),
        sortable: field.sortable,
        type: field.type
      })),
      childRelationships: value.childRelationships.map(child => ({
        childSObject: child.childSObject,
        field: child.field,
        relationshipName: child.relationshipName
      }))
    })),
    Effect.flatMap(Schema.decodeUnknownEffect(SObjectSchema))
  );
const restSemanticField = (field: SObject['fields'][number]): SemanticField => ({
  name: field.name,
  label: field.label,
  type: field.type,
  custom: field.custom,
  defaultValue: field.defaultValue,
  ...(isNull(field.inlineHelpText) ? {} : { inlineHelpText: field.inlineHelpText }),
  ...(isUndefined(field.length) ? {} : { length: field.length }),
  ...(isUndefined(field.precision) ? {} : { precision: field.precision }),
  ...(isUndefined(field.scale) ? {} : { scale: field.scale }),
  referenceTo: field.referenceTo.toSorted(Order.String),
  ...(isNull(field.relationshipName) ? {} : { relationshipName: field.relationshipName }),
  picklistValues: field.picklistValues
    .map(item => ({ value: item.value, active: item.active, ...(isNull(item.label) ? {} : { label: item.label }) }))
    .toSorted(byPicklist),
  runtimeCapabilities: {
    aggregatable: field.aggregatable,
    filterable: field.filterable,
    groupable: field.groupable,
    nillable: field.nillable,
    sortable: field.sortable
  }
});
const RestInput = Schema.Struct({
  source: Schema.Literal('rest-sobject-describe'),
  identity: SObjectArtifactIdentitySchema,
  value: Schema.Unknown
});
const WorkspaceInput = Schema.Struct({
  source: Schema.Literal('workspace-sobject-metadata'),
  identity: SObjectArtifactIdentitySchema,
  value: Schema.Struct({
    object: workspaceDocument('CustomObject'),
    fields: Schema.Array(workspaceDocument('CustomField'))
  })
});
const simpleFieldName = (objectName: string, fullName: string) =>
  fullName.toLowerCase().startsWith(`${objectName}.`.toLowerCase()) ? fullName.slice(objectName.length + 1) : fullName;
const workspaceSemanticField = (
  objectName: string,
  documentName: string,
  definitionUri: URI,
  field: Readonly<Record<string, unknown>>
) => {
  const decoded = Schema.decodeUnknownSync(WorkspaceFieldMetadata)(field);
  const fullName = decoded.fullName ?? Schema.decodeUnknownSync(optionalTrimmedString)(documentName);
  if (isUndefined(fullName)) return Option.none();
  const name = simpleFieldName(objectName, fullName);
  return Option.some({
    name,
    custom: customApiName(name),
    definitionUri,
    ...Rec.filter(
      {
        label: decoded.label,
        type: decoded.type,
        defaultValue: decoded.defaultValue,
        inlineHelpText: decoded.inlineHelpText,
        length: decoded.length,
        precision: decoded.precision,
        scale: decoded.scale,
        relationshipName: decoded.relationshipName,
        referenceTo: decoded.referenceTo.length > 0 ? decoded.referenceTo : undefined,
        picklistValues: decoded.valueSet.length > 0 ? decoded.valueSet : undefined
      },
      isNotUndefined
    )
  });
};
const workspaceModel = (input: typeof WorkspaceInput.Type) => {
  const decoded = Schema.decodeUnknownSync(WorkspaceObjectMetadata)(input.value.object.metadata);
  const nameField = Schema.is(metadataRecord)(decoded.nameField)
    ? { ...decoded.nameField, fullName: 'Name' }
    : undefined;
  const object = input.value.object;
  const fields = [
    ...decoded.fields
      .filter(Schema.is(metadataRecord))
      .map(field => ({ documentName: object.fullName, definitionUri: object.definitionUri, field })),
    ...(nameField ? [{ documentName: object.fullName, definitionUri: object.definitionUri, field: nameField }] : []),
    ...input.value.fields.map(document => ({
      documentName: document.fullName,
      definitionUri: document.definitionUri,
      field: document.metadata
    }))
  ].flatMap(source =>
    Option.toArray(workspaceSemanticField(input.identity.name, source.documentName, source.definitionUri, source.field))
  );
  return {
    kind: 'sobject',
    value: {
      identity: input.identity,
      custom: customApiName(input.identity.name),
      fields: HashMap.toValues(
        HashMap.fromIterable(fields.map(field => [field.name.toLowerCase(), field] as const))
      ).toSorted(byName),
      definitionUri: object.definitionUri,
      ...Rec.filter({ label: decoded.label, pluralLabel: decoded.pluralLabel }, isNotUndefined)
    }
  };
};

export const TransmogrifierServiceLayer = Layer.effect(
  TransmogrifierService,
  Effect.gen(function* () {
    const operations = yield* ServiceOperations;
    const toMinimalSObject = Effect.fn('TransmogrifierService.toMinimalSObject')(
      (raw: DescribeSObjectResult) => decodeMinimal(raw),
      operations.run
    );
    const decodeSObject = Effect.fn('TransmogrifierService.decodeSObject')(
      (input: unknown) => Schema.decodeUnknownEffect(SObjectSchema)(input),
      operations.run
    );
    const toSemanticModel = Effect.fn('TransmogrifierService.toSemanticModel')(
      function* (input: TransmogrifierInput) {
        if (input.source === 'persisted-semantic-model') {
          const persisted = yield* Schema.decodeUnknownEffect(SObjectSemanticModelSchema)(input.value).pipe(
            Effect.catchTag('SchemaError', cause =>
              Effect.fail(
                new TransmogrifierError({
                  source: input.source,
                  message: 'Failed to validate the persisted canonical semantic model',
                  cause
                })
              )
            )
          );
          if (!artifactIdentitiesEqual(input.identity, persisted.value.identity))
            return yield* new TransmogrifierError({
              source: input.source,
              message: 'Persisted semantic model identity does not match the requested artifact identity',
              cause: { requested: input.identity, received: persisted.value.identity }
            });
          return persisted;
        }
        if (input.source === 'rest-sobject-describe') {
          const raw = yield* Schema.decodeUnknownEffect(RestInput)(input);
          const value = yield* decodeMinimal(raw.value);
          return yield* Schema.decodeUnknownEffect(SObjectSemanticModelSchema)({
            kind: 'sobject',
            value: {
              identity: raw.identity,
              label: value.label,
              custom: value.custom,
              queryable: value.queryable,
              fields: value.fields.map(restSemanticField).toSorted(byName),
              childRelationships: value.childRelationships
                .map(child => ({
                  childSObject: child.childSObject,
                  field: child.field,
                  ...(isNull(child.relationshipName) ? {} : { relationshipName: child.relationshipName })
                }))
                .toSorted(byChild)
            }
          });
        }
        const workspace = yield* Schema.decodeUnknownEffect(WorkspaceInput)(input);
        // definitionUri is already a native URI; do not feed it through the string-encoded URI codec again.
        const model = yield* Effect.try({
          try: () => workspaceModel(workspace),
          catch: cause =>
            new TransmogrifierError({
              source: input.source,
              message: 'Failed to normalize workspace metadata into the canonical semantic model',
              cause
            })
        });
        return yield* Schema.decodeUnknownEffect(Schema.toType(SObjectSemanticModelSchema))(model);
      },
      (effect, input) =>
        effect.pipe(
          Effect.catchTag('SchemaError', cause =>
            Effect.fail(
              new TransmogrifierError({
                source: input.source,
                message: `Failed to transform ${input.source} into the canonical semantic model`,
                cause
              })
            )
          )
        ),
      operations.run
    );
    return TransmogrifierService.of({ toMinimalSObject, decodeSObject, toSemanticModel, SObjectSchema });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
