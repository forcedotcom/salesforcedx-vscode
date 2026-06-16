/*
 *  Copyright (c) 2021, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { SObjectFieldType } from '@salesforce/soql-model/model';
import { SObjectMetadata } from './message/soqlEditorEvent';

type NormalizedField = {
  name: string;
  type: SObjectFieldType;
  picklistValues: string[];
  nillable: boolean;
}

export class SObjectTypeUtils {
  protected fieldMap: { [key: string]: NormalizedField };
  protected typeMap: { [key: string]: SObjectFieldType };
  public constructor(protected sobjectMetadata: SObjectMetadata | undefined) {
    this.fieldMap = {};
    if (sobjectMetadata?.fields) {
      sobjectMetadata.fields.forEach(field => {
        this.fieldMap[field.name.toLowerCase()] = {
          name: field.name,
          type: field.type as SObjectFieldType,
          picklistValues:
            field.picklistValues && Array.isArray(field.picklistValues)
              ? (field.picklistValues as Array<{ value: string }>).map(pv => pv.value)
              : [],
          nillable: field.nillable
        };
      });
    }
    this.typeMap = {};
    Object.keys(SObjectFieldType).forEach((key) => {
      this.typeMap[SObjectFieldType[key].toLowerCase()] =
        SObjectFieldType[key];
    });
  }

  public getType(fieldName: string): SObjectFieldType {
    let type = SObjectFieldType.AnyType;
    const field = this.fieldMap[fieldName.toLowerCase()];
    if (field) {
      const fieldType = this.typeMap[field.type.toLowerCase()];
      if (fieldType) {
        type = fieldType;
      }
    }
    return type;
  }

  public getPicklistValues(fieldName: string): string[] {
    const field = this.fieldMap[fieldName.toLowerCase()];
    return field ? field.picklistValues : [];
  }

  public getNillable(fieldName: string): boolean {
    const field = this.fieldMap[fieldName.toLowerCase()];
    if (field) {
      return field.nillable;
    }
    return undefined;
  }
}
