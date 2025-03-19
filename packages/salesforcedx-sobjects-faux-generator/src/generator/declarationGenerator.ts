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

export const generateSObjectDefinition = (sobject: SObject): SObjectDefinition => {
  const declarations: FieldDeclaration[] = [];

  if (sobject.fields) {
    for (const field of sobject.fields) {
      const decls: FieldDeclaration[] = generateField(field);
      if (decls && decls.length > 0) {
        for (const decl of decls) {
          declarations.push(decl);
        }
      }
    }
  }

  if (sobject.childRelationships) {
    for (const rel of sobject.childRelationships) {
      if (rel.relationshipName) {
        const decl = generateChildRelationship(rel);
        if (decl) {
          declarations.push(decl);
        }
      }
    }

    for (const rel of sobject.childRelationships) {
      // handle the odd childRelationships last (without relationshipName)
      if (!rel.relationshipName) {
        const decl = generateChildRelationship(rel);
        if (decl) {
          declarations.push(decl);
        }
      }
    }
  }

  return { name: sobject.name, fields: declarations };
};

const generateField = (field: SObjectField): FieldDeclaration[] => {
  const common = {
    modifier: MODIFIER,
    ...(field.inlineHelpText ? { comment: field.inlineHelpText } : {})
  };
  if (!field.referenceTo || field.referenceTo.length === 0) {
    // should be a normal field EXCEPT for external lookup & metadata relationship
    // which is a reference, but no referenceTo targets
    const genType = field.extraTypeInfo === 'externallookup' ? 'String' : getTargetType(field.type);
    return [
      {
        ...common,
        type: genType,
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
