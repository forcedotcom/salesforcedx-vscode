/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  MetadataDocumentationService,
  resolveInheritedFields
} from '../../../src/metadataSupport/metadataDocumentationService';

type Field = { name: string; type: string; description: string; required?: boolean };

const field = (name: string, description: string, type = 'string'): Field => ({
  name,
  type,
  description,
  required: false
});

const typeDoc = (name: string, fields: Field[], developerGuideUrls?: string[]) => ({
  name,
  description: `${name} doc`,
  fields,
  developerGuideUrls
});

// Mirrors the Flow hierarchy in the shipped XSD: FlowDecision -> FlowNode -> FlowElement -> FlowBaseElement
const buildFlowMap = () =>
  new Map([
    ['FlowBaseElement', typeDoc('FlowBaseElement', [field('processMetadataValues', 'Contextual information.')])],
    ['FlowElement', typeDoc('FlowElement', [field('name', 'Unique name of the flow element.')])],
    ['FlowNode', typeDoc('FlowNode', [field('label', 'Label of the node.')])],
    ['FlowDecision', typeDoc('FlowDecision', [field('rules', 'Decision rules.', 'FlowRule[]')])],
    ['Flow', typeDoc('Flow', [field('decisions', 'Decisions in the flow.', 'FlowDecision[]')])]
  ]);

const flowBases = new Map([
  ['FlowDecision', 'FlowNode'],
  ['FlowNode', 'FlowElement'],
  ['FlowElement', 'FlowBaseElement']
]);

const fieldNames = (map: Map<string, { fields?: Field[] }>, typeName: string) =>
  map.get(typeName)?.fields?.map(f => f.name);

describe('resolveInheritedFields', () => {
  it('appends fields from every ancestor after the type’s own fields', () => {
    const map = buildFlowMap();
    resolveInheritedFields(map, flowBases);

    expect(fieldNames(map, 'FlowDecision')).toEqual(['rules', 'label', 'name', 'processMetadataValues']);
    expect(fieldNames(map, 'FlowNode')).toEqual(['label', 'name', 'processMetadataValues']);
    expect(fieldNames(map, 'FlowBaseElement')).toEqual(['processMetadataValues']);
  });

  it('keeps the type’s own declaration when it redeclares an inherited field', () => {
    const map = new Map([
      ['Base', typeDoc('Base', [field('label', 'Base label.')])],
      ['Child', typeDoc('Child', [field('label', 'Child label.')])]
    ]);
    resolveInheritedFields(map, new Map([['Child', 'Base']]));

    expect(map.get('Child')?.fields).toEqual([field('label', 'Child label.')]);
  });

  it('keeps own fields when the base type is not in the map', () => {
    const map = new Map([['EmailAuthorizationSettings', typeDoc('EmailAuthorizationSettings', [field('a', 'A.')])]]);
    resolveInheritedFields(map, new Map([['EmailAuthorizationSettings', 'MetadataForSettings']]));

    expect(fieldNames(map, 'EmailAuthorizationSettings')).toEqual(['a']);
  });

  it('terminates on an inheritance cycle', () => {
    const map = new Map([
      ['A', typeDoc('A', [field('a', 'A.')])],
      ['B', typeDoc('B', [field('b', 'B.')])]
    ]);
    resolveInheritedFields(
      map,
      new Map([
        ['A', 'B'],
        ['B', 'A']
      ])
    );

    expect(fieldNames(map, 'A')).toEqual(['a', 'b']);
    expect(fieldNames(map, 'B')).toEqual(['b', 'a']);
  });
});

const foundDescription = (result: ReturnType<MetadataDocumentationService['getFieldDocumentation']>) =>
  result._tag === 'Found' ? result.field.description : undefined;

describe('MetadataDocumentationService.getFieldDocumentation with inherited fields', () => {
  const createService = () => {
    const service = new MetadataDocumentationService();
    const map = buildFlowMap();
    resolveInheritedFields(map, flowBases);
    (service as any).documentationMap = map;
    return service;
  };

  it('returns the base type’s documentation for an inherited field', () => {
    const result = createService().getFieldDocumentation('Flow', 'name', ['decisions']);

    expect(foundDescription(result)).toBe('Unique name of the flow element.');
  });

  it('returns documentation for a field inherited from a grandparent', () => {
    const result = createService().getFieldDocumentation('Flow', 'processMetadataValues', ['decisions']);

    expect(foundDescription(result)).toBe('Contextual information.');
  });
});

describe('MetadataDocumentationService.getFieldDocumentation for nonexistent fields', () => {
  const customObjectUrl = 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/customobject.htm';

  const createService = () => {
    const service = new MetadataDocumentationService();
    const map = new Map([
      ['Metadata', typeDoc('Metadata', [field('fullName', '')])],
      [
        'CustomObject',
        typeDoc(
          'CustomObject',
          [
            field('label', 'Label that represents the object.'),
            field('fields', 'Definition of a field in the object.', 'CustomField[]'),
            field('enableHistory', '', 'boolean'),
            field('customButtons', 'Custom buttons.', 'string[]'),
            field('userPermissions', 'User permissions.', 'PermissionSetUserPermissions[]'),
            field('spacedFields', 'Fields scraped with a space before the brackets.', 'CustomField []'),
            field(
              'mislabeledField',
              'Complex type scraped as an enumeration.',
              'CustomField (enumeration of type string)'
            ),
            field('deploymentStatus', 'Deployment status.', 'DeploymentStatus (enumeration of type string)')
          ],
          [customObjectUrl]
        )
      ],
      ['CustomField', typeDoc('CustomField', [field('type', 'Indicates the field type.')])],
      ['AddressSettings', typeDoc('AddressSettings', [])],
      ['Flow', typeDoc('Flow', [field('decisions', 'Decisions in the flow.', 'FlowDecision[]')])],
      ['FlowDecision', typeDoc('FlowDecision', [field('rules', 'Decision rules.', 'FlowRule[]')])]
    ]);
    resolveInheritedFields(
      map,
      new Map([
        ['CustomObject', 'Metadata'],
        ['CustomField', 'Metadata'],
        ['AddressSettings', 'Metadata'],
        ['Flow', 'Metadata']
      ])
    );
    (service as any).documentationMap = map;
    return service;
  };

  it('reports a field missing from a type with field data as unknown', () => {
    expect(createService().getFieldDocumentation('CustomObject', 'bogusField')).toEqual({
      _tag: 'UnknownField',
      typeName: 'CustomObject',
      fieldName: 'bogusField',
      developerGuideUrl: customObjectUrl
    });
  });

  it('reports a missing description field as unknown instead of using the hardcoded text', () => {
    expect(createService().getFieldDocumentation('CustomObject', 'description')).toEqual({
      _tag: 'UnknownField',
      typeName: 'CustomObject',
      fieldName: 'description',
      developerGuideUrl: customObjectUrl
    });
  });

  it('reports the first unknown parent element instead of falling back to an outer type', () => {
    expect(createService().getFieldDocumentation('CustomObject', 'label', ['notAField'])).toEqual({
      _tag: 'UnknownField',
      typeName: 'CustomObject',
      fieldName: 'notAField',
      developerGuideUrl: customObjectUrl
    });
  });

  it('reports an unknown field on a nested type without a developer guide link', () => {
    expect(createService().getFieldDocumentation('Flow', 'bogusField', ['decisions'])).toEqual({
      _tag: 'UnknownField',
      typeName: 'FlowDecision',
      fieldName: 'bogusField',
      developerGuideUrl: undefined
    });
  });

  it('reports fullName as unknown on a nested type without a fullName field', () => {
    expect(createService().getFieldDocumentation('Flow', 'fullName', ['decisions'])).toEqual({
      _tag: 'UnknownField',
      typeName: 'FlowDecision',
      fieldName: 'fullName',
      developerGuideUrl: undefined
    });
  });

  it('returns documentation for a nested field that exists', () => {
    expect(foundDescription(createService().getFieldDocumentation('CustomObject', 'type', ['fields']))).toBe(
      'Indicates the field type.'
    );
  });

  it('still uses the hardcoded fullName text when the inherited fullName has no description', () => {
    expect(foundDescription(createService().getFieldDocumentation('CustomObject', 'fullName'))).toBe(
      'The unique name of the metadata component. This is the API name used to reference the component.'
    );
  });

  it('keeps generated text for an existing field with no description', () => {
    const result = createService().getFieldDocumentation('CustomObject', 'enableHistory');

    expect(result).toMatchObject({ _tag: 'Found', field: { name: 'enableHistory', type: 'boolean' } });
  });

  it('does not report unknown fields for a type with no field data beyond fullName', () => {
    expect(createService().getFieldDocumentation('AddressSettings', 'countriesAndStates')._tag).toBe('Found');
  });

  it('reports a child of a primitive field', () => {
    expect(createService().getFieldDocumentation('CustomObject', 'anything', ['label'])).toEqual({
      _tag: 'PrimitiveParent',
      typeName: 'CustomObject',
      parentName: 'label',
      parentType: 'string',
      childName: 'anything',
      developerGuideUrl: customObjectUrl
    });
  });

  it('reports the element directly below a primitive field, not the hovered field', () => {
    expect(createService().getFieldDocumentation('CustomObject', 'deeper', ['label', 'inner'])).toEqual({
      _tag: 'PrimitiveParent',
      typeName: 'CustomObject',
      parentName: 'label',
      parentType: 'string',
      childName: 'inner',
      developerGuideUrl: customObjectUrl
    });
  });

  it('reports a child of a primitive array field', () => {
    expect(createService().getFieldDocumentation('CustomObject', 'anything', ['customButtons'])).toEqual({
      _tag: 'PrimitiveParent',
      typeName: 'CustomObject',
      parentName: 'customButtons',
      parentType: 'string',
      childName: 'anything',
      developerGuideUrl: customObjectUrl
    });
  });

  it('does not report children of a field whose type the XSD does not define', () => {
    // e.g. PermissionSet.userPermissions: the scraper never captured PermissionSetUserPermissions
    expect(createService().getFieldDocumentation('CustomObject', 'enabled', ['userPermissions'])._tag).toBe('Found');
  });

  it('does not report children of an enumeration field', () => {
    expect(createService().getFieldDocumentation('CustomObject', 'anything', ['deploymentStatus'])._tag).toBe('Found');
  });

  it('resolves a type name with a space before the array brackets', () => {
    expect(foundDescription(createService().getFieldDocumentation('CustomObject', 'type', ['spacedFields']))).toBe(
      'Indicates the field type.'
    );
  });

  it('resolves a complex type mislabeled as an enumeration', () => {
    expect(foundDescription(createService().getFieldDocumentation('CustomObject', 'type', ['mislabeledField']))).toBe(
      'Indicates the field type.'
    );
  });
});
