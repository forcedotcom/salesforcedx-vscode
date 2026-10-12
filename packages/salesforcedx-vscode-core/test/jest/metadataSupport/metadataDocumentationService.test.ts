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

const typeDoc = (name: string, fields: Field[]) => ({ name, description: `${name} doc`, fields });

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

describe('MetadataDocumentationService.getFieldDocumentation with inherited fields', () => {
  const createService = () => {
    const service = new MetadataDocumentationService();
    const map = buildFlowMap();
    resolveInheritedFields(map, flowBases);
    (service as any).documentationMap = map;
    return service;
  };

  it('returns the base type’s documentation for an inherited field', () => {
    const doc = createService().getFieldDocumentation('Flow', 'name', ['decisions']);

    expect(doc?.description).toBe('Unique name of the flow element.');
  });

  it('returns documentation for a field inherited from a grandparent', () => {
    const doc = createService().getFieldDocumentation('Flow', 'processMetadataValues', ['decisions']);

    expect(doc?.description).toBe('Contextual information.');
  });
});
