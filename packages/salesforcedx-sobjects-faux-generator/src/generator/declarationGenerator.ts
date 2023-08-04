/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ChildRelationship,
  FieldDeclaration,
  SObject,
  SObjectDefinition
} from '../types';
import { SObjectField } from '../types/describe';

export const MODIFIER = 'global';

export class DeclarationGenerator {
  private static typeMapping: Map<string, string> = new Map([
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

  public generateSObjectDefinitions(sobjects: SObject[]): SObjectDefinition[] {
    const definitions: SObjectDefinition[] = sobjects.map(sobject => {
      const declarations = this.generateSObjectDefinition(sobject);
      return {
        name: sobject.name,
        fields: declarations.fields
      };
    });

    return definitions;
  }

  public generateSObjectDefinition(sobject: SObject): SObjectDefinition {
    const fields = (sobject.fields || [])
      .map(field => this.generateField(field) ?? [])
      .flat();

    const childRelationShips = (sobject.childRelationships || [])
      .sort((l, r) => {
        // both have relationshipName, sort by that using localeCompare
        if (l.relationshipName && r.relationshipName) {
          return l.relationshipName.localeCompare(r.relationshipName);
        }
        // only one has relationshipName, sort that one first
        if (l.relationshipName) {
          return -1;
        }
        if (r.relationshipName) {
          return 1;
        }
        return 0;
      })
      .map(rel => this.generateChildRelationship(rel))
      .flat();

    return { name: sobject.name, fields: [...fields, ...childRelationShips] };
  }

  private stripId(name: string): string {
    return name.replaceAll(/Id$/g, '');
  }

  private capitalize(input: string): string {
    return input.charAt(0).toUpperCase() + input.slice(1);
  }

  private getTargetType(describeType: string): string {
    const gentype = DeclarationGenerator.typeMapping.get(
      describeType
    ) as string;
    return gentype ? gentype : this.capitalize(describeType);
  }

  private getReferenceName(
    name: string,
    relationshipName?: string | null
  ): string {
    return relationshipName ? relationshipName : this.stripId(name);
  }

  private generateChildRelationship(rel: ChildRelationship): FieldDeclaration {
    const name = this.getReferenceName(rel.field, rel.relationshipName);
    return {
      modifier: MODIFIER,
      type: `List<${rel.childSObject}>`,
      name
    };
  }

  private generateField(field: SObjectField): FieldDeclaration[] {
    const decls: FieldDeclaration[] = [];
    const comment = field.inlineHelpText;

    if (field.referenceTo?.length === 0) {
      // should be a normal field EXCEPT for external lookup & metadata relationship
      // which is a reference, but no referenceTo targets
      const genType =
        field.extraTypeInfo === 'externallookup'
          ? 'String'
          : this.getTargetType(field.type);

      decls.push(
        Object.assign(
          {
            modifier: MODIFIER,
            type: genType,
            name: field.name
          },
          comment ? { comment } : {}
        )
      );
    } else {
      const name = this.getReferenceName(field.name, field.relationshipName);

      decls.push(
        Object.assign(
          {
            modifier: MODIFIER,
            name,
            type:
              field.referenceTo && field.referenceTo.length > 1
                ? 'SObject'
                : `${field.referenceTo}`
          },
          comment ? { comment } : {}
        )
      );
      // field.type will be "reference", but the actual type is an Id for Apex
      decls.push(
        Object.assign(
          {
            modifier: MODIFIER,
            name: field.name,
            type: 'Id'
          },
          comment ? { comment } : {}
        )
      );
    }
    return decls;
  }
}
