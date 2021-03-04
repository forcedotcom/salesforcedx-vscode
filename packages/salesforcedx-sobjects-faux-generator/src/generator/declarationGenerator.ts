/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChildRelationship, Field, SObject } from '../types';

export const MODIFIER = 'global';
export interface FieldDeclaration {
  modifier: string;
  type: string;
  name: string;
  comment?: string;
}

export interface SObjectDefinition {
  name: string;
  fields: FieldDeclaration[];
}

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

  public generateFieldDeclarations(sobject: SObject): SObjectDefinition {
    const declarations: FieldDeclaration[] = [];
    if (sobject.fields) {
      for (const field of sobject.fields) {
        const decls: FieldDeclaration[] = this.generateField(field);
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
          const decl: FieldDeclaration = this.generateChildRelationship(rel);
          if (decl) {
            declarations.push(decl);
          }
        }
      }
      for (const rel of sobject.childRelationships) {
        // handle the odd childRelationships last (without relationshipName)
        if (!rel.relationshipName) {
          const decl: FieldDeclaration = this.generateChildRelationship(rel);
          if (decl) {
            declarations.push(decl);
          }
        }
      }
    }
    return { name: sobject.name, fields: declarations };
  }

  private stripId(name: string): string {
    if (name.endsWith('Id')) {
      return name.slice(0, name.length - 2);
    } else {
      return name;
    }
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

  private getReferenceName(relationshipName: string, name: string): string {
    return relationshipName ? relationshipName : this.stripId(name);
  }

  private generateChildRelationship(rel: ChildRelationship): FieldDeclaration {
    const name = this.getReferenceName(rel.relationshipName, rel.field);
    return {
      modifier: MODIFIER,
      type: `List<${rel.childSObject}>`,
      name
    };
  }

  private generateField(field: Field): FieldDeclaration[] {
    const decls: FieldDeclaration[] = [];
    const comment = field.inlineHelpText;
    let genType = '';
    if (field.referenceTo.length === 0) {
      // should be a normal field EXCEPT for external lookup & metadata relationship
      // which is a reference, but no referenceTo targets
      if (field.extraTypeInfo === 'externallookup') {
        genType = 'String';
      } else {
        genType = this.getTargetType(field.type);
      }

      decls.push({
        modifier: MODIFIER,
        type: genType,
        name: field.name,
        comment
      });
    } else {
      const name = this.getReferenceName(field.relationshipName, field.name);

      decls.push({
        modifier: MODIFIER,
        name,
        type: field.referenceTo.length > 1 ? 'SObject' : `${field.referenceTo}`,
        comment
      });
      // field.type will be "reference", but the actual type is an Id for Apex
      decls.push({
        modifier: MODIFIER,
        name: field.name,
        type: 'Id',
        comment
      });
    }
    return decls;
  }
}
