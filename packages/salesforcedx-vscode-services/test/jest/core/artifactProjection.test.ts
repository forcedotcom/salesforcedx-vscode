/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import {
  ApexTypeStubSchema,
  ArtifactProjectionSchema,
  CatalogEntryDescriptorSchema,
  ProjectionUnavailableSchema,
  SObjectSemanticModelSchema,
  SourceDocumentSchema,
  type SObjectSemanticModel
} from '../../../src/core/artifactProjection';

const emptyApexStub = (overrides: Record<string, unknown> = {}) => ({
  name: 'Example',
  namespacePrefix: null,
  kind: 'CLASS',
  modifiers: ['public'],
  annotations: [],
  superClass: null,
  interfaces: [],
  fields: [],
  properties: [],
  methods: [],
  innerTypes: [],
  triggerOperations: null,
  triggerObjectType: null,
  documentation: null,
  compileError: null,
  ...overrides
});

describe('canonical artifact projections', () => {
  it('decodes an actual source URI and encodes it back to a JSON-safe string', () => {
    const input = {
      kind: 'source-document',
      identity: { kind: 'apex-type', namespace: null, name: 'WorkspaceClass' },
      fidelity: 'actual-source',
      uri: 'file:///workspace/classes/WorkspaceClass.cls',
      languageId: 'apex'
    } as const;

    const decoded = Schema.decodeUnknownSync(SourceDocumentSchema)(input);

    expect(decoded.uri.toString()).toBe(input.uri);
    expect(Schema.encodeSync(SourceDocumentSchema)(decoded)).toEqual(input);
    expect(() => Schema.decodeUnknownSync(SourceDocumentSchema)({ ...input, fidelity: 'stub-source' })).toThrow(
      'actual-source'
    );
  });

  it('represents truthful partial workspace SObject semantics without fabricated REST capabilities', () => {
    const decoded: SObjectSemanticModel = Schema.decodeUnknownSync(SObjectSemanticModelSchema)({
      kind: 'sobject',
      value: {
        identity: { kind: 'sobject', namespace: null, name: 'Broker__c' },
        label: 'Broker',
        fields: [
          {
            name: 'Email__c',
            type: 'Email',
            definitionUri: 'file:///workspace/objects/Broker__c/fields/Email__c.field-meta.xml'
          }
        ],
        definitionUri: 'file:///workspace/objects/Broker__c/Broker__c.object-meta.xml'
      }
    });

    expect(decoded.value.queryable).toBeUndefined();
    expect(decoded.value.fields[0].runtimeCapabilities).toBeUndefined();
    expect(decoded.value.definitionUri?.scheme).toBe('file');
    expect(decoded.value.fields[0].definitionUri?.path).toContain('Email__c.field-meta.xml');
  });

  it('accepts REST-known runtime SObject capabilities when they are available', () => {
    const decoded = Schema.decodeUnknownSync(SObjectSemanticModelSchema)({
      kind: 'sobject',
      value: {
        identity: { kind: 'sobject', namespace: null, name: 'Account' },
        custom: false,
        queryable: true,
        fields: [
          {
            name: 'Name',
            type: 'string',
            runtimeCapabilities: {
              aggregatable: true,
              filterable: true,
              groupable: true,
              nillable: false,
              sortable: true
            }
          }
        ],
        childRelationships: []
      }
    });

    expect(decoded.value.queryable).toBe(true);
    expect(decoded.value.fields[0].runtimeCapabilities?.nillable).toBe(false);
  });

  it('decodes recursive Apex inner types and nested generic references', () => {
    const decoded = Schema.decodeUnknownSync(ApexTypeStubSchema)(
      emptyApexStub({
        namespacePrefix: 'MyPackage',
        name: 'Outer',
        interfaces: [
          {
            namespacePrefix: 'System',
            name: 'Iterator',
            typeParameters: [
              {
                namespacePrefix: null,
                name: 'List',
                typeParameters: [{ namespacePrefix: null, name: 'String', typeParameters: null }]
              }
            ]
          }
        ],
        innerTypes: [emptyApexStub({ name: 'Outer.Inner', namespacePrefix: 'MyPackage' })]
      })
    );

    expect(decoded.interfaces[0].typeParameters?.[0].typeParameters?.[0].name).toBe('String');
    expect(decoded.innerTypes[0]).toMatchObject({ name: 'Outer.Inner', namespacePrefix: 'MyPackage' });
  });

  it('requires explicit canonical nulls that the raw endpoint adapter will normalize', () => {
    const incomplete: Record<string, unknown> = emptyApexStub();
    delete incomplete.documentation;

    expect(() => Schema.decodeUnknownSync(ApexTypeStubSchema)(incomplete)).toThrow('documentation');
  });

  it('decodes catalog descriptors without conflating workspace and org locations', () => {
    const decoded = Schema.decodeUnknownSync(CatalogEntryDescriptorSchema)({
      kind: 'catalog-entry',
      identity: { kind: 'metadata-component', metadataType: 'ApexClass', namespace: null, name: 'Example' },
      presence: 'both',
      providers: ['workspace', 'metadata-api'],
      workspaceUri: 'file:///workspace/classes/Example.cls',
      orgUri: 'sf-org-metadata:/orgs/00D/ApexClass/Example.cls'
    });

    expect(decoded.workspaceUri?.scheme).toBe('file');
    expect(decoded.orgUri?.scheme).toBe('sf-org-metadata');
  });

  it.each([
    { kind: 'catalog-entry' },
    { kind: 'source-document' },
    { kind: 'semantic-model', model: 'sobject' },
    { kind: 'semantic-model', model: 'apex-type-stub' }
  ] as const)('publishes the $kind projection descriptor', projection => {
    expect(Schema.decodeUnknownSync(ArtifactProjectionSchema)(projection)).toEqual(projection);
  });

  it('reports projection unavailability separately from not-found', () => {
    const unavailable = {
      kind: 'projection-unavailable',
      reason: 'protected-source',
      availableProjections: [{ kind: 'catalog-entry' }, { kind: 'semantic-model', model: 'apex-type-stub' }]
    } as const;

    expect(Schema.decodeUnknownSync(ProjectionUnavailableSchema)(unavailable)).toEqual(unavailable);
  });
});
