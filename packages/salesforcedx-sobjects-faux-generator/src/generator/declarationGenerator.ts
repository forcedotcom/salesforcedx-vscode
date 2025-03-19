/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChildRelationship, FieldDeclaration, SObject, SObjectDefinition } from '../types';
import { SObjectField } from '../types/describe';

export const MODIFIER = 'global';

const typeMapping: Map<string, string> = new Map([
  ['string', 'String'],
  ['double', 'Double'],
  ['reference', ''],
  ['boolean', 'Boolean'],
  ['currency', 'Decimal'],
  ['date', 'Date'],
  ['datetime', 'Datetime'],
  ['email', 'String'],
  ['location', 'Location'],
  ['percent', 'Double'],
  ['phone', 'String'],
  ['picklist', 'String'],
  ['multipicklist', 'String'],
  ['textarea', 'String'],
  ['encryptedstring', 'String'],
  ['url', 'String'],
  ['id', 'Id'],
  // note that the mappings below "id" only occur in standard SObjects
  ['base64', 'Blob'],
  ['address', 'Address'],
  ['int', 'Integer'],
  ['anyType', 'Object'],
  ['combobox', 'String'],
  ['time', 'Time'],
  // TBD what are these mapped to and how to create them
  // ['calculated', 'xxx'],
  // ['masterrecord', 'xxx'],
  ['complexvalue', 'Object']
]);

export const generateSObjectDefinition = (sobject: SObject): SObjectDefinition => ({
  name: sobject.name,
  fields: [
    ...(sobject.fields ?? []).flatMap(generateField),
    // ones with relationship names need to be earlier in the list
    ...(sobject.childRelationships ?? []).sort(relationshipNameFirst).flatMap(generateChildRelationship)
  ]
});

const relationshipNameFirst = (a: ChildRelationship, b: ChildRelationship): number =>
  a.relationshipName && !b.relationshipName ? -1 : b.relationshipName && !a.relationshipName ? 1 : 0;

const generateField = (field: SObjectField): FieldDeclaration[] => {
  const common = {
    modifier: MODIFIER,
    ...(field.inlineHelpText ? { comment: field.inlineHelpText } : {})
  };
  if (!field.referenceTo || field.referenceTo.length === 0) {
    // should be a normal field EXCEPT for external lookup & metadata relationship
    // which is a reference, but no referenceTo targets
    return [
      {
        ...common,
        type: field.extraTypeInfo === 'externallookup' ? 'String' : getTargetType(field.type),
        name: field.name
      }
    ];
  }
  return [
    {
      ...common,
      name: getReferenceName(field.name, field.relationshipName),
      type: field.referenceTo && field.referenceTo.length > 1 ? 'SObject' : `${field.referenceTo.join()}`
    },
    {
      ...common,
      name: field.name,
      type: 'Id'
    }
  ];
};

const getTargetType = (describeType: string): string => typeMapping.get(describeType) ?? capitalize(describeType);

const generateChildRelationship = (rel: ChildRelationship): FieldDeclaration => ({
  modifier: MODIFIER,
  type: `List<${rel.childSObject}>`,
  name: getReferenceName(rel.field, rel.relationshipName)
});

const capitalize = (input: string): string => input.charAt(0).toUpperCase() + input.slice(1);

const getReferenceName = (name: string, relationshipName?: string | null): string =>
  relationshipName ? relationshipName : stripId(name);

const stripId = (name: string): string => (name.endsWith('Id') ? name.slice(0, name.length - 2) : name);
