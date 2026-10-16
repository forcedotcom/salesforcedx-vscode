/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SObjectFieldType } from '@salesforce/soql-model';
import {
  fieldMap,
  getNillable,
  getPicklistValues,
  getType
} from '../../../../../../src/soql-builder-ui/modules/querybuilder/services/sobjectUtils';

describe('sobject field map should', () => {
  const sobjectMetadata = {
    fields: [
      { name: 'Id', type: 'id', picklistValues: [] },
      { name: 'Name', type: 'string', picklistValues: [] },
      {
        name: 'AccountSource',
        type: 'picklist',
        picklistValues: [{ value: 'apple' }, { value: 'banana' }, { value: 'cherry' }]
      },
      { name: 'AnnualRevenue', type: 'currency', picklistValues: [] },
      { name: 'BillingAddress', type: 'address', picklistValues: [] },
      { name: 'IsBuyer', type: 'boolean', picklistValues: [] },
      {
        name: 'CleanStatus',
        type: 'picklist',
        picklistValues: [{ value: 'apple' }, { value: 'banana' }, { value: 'cherry' }]
      },
      { name: 'CreatedById', type: 'reference', picklistValues: [] },
      { name: 'DandbCompanyId', type: 'reference', picklistValues: [] },
      { name: 'Jigsaw', type: 'string', picklistValues: [] },
      {
        name: 'Industry',
        type: 'picklist',
        picklistValues: [{ value: 'apple' }, { value: 'banana' }, { value: 'cherry' }]
      },
      { name: 'Phone', type: 'phone', picklistValues: [] }
    ]
  };

  it('return the type of a field found in an SObject', () => {
    const expected = [
      SObjectFieldType.Id,
      SObjectFieldType.String,
      SObjectFieldType.Picklist,
      SObjectFieldType.Currency,
      SObjectFieldType.Address,
      SObjectFieldType.Boolean,
      SObjectFieldType.Picklist,
      SObjectFieldType.Reference,
      SObjectFieldType.Reference,
      SObjectFieldType.String,
      SObjectFieldType.Picklist,
      SObjectFieldType.Phone
    ];
    const fields = fieldMap(sobjectMetadata);
    const actual = sobjectMetadata.fields.map(field => getType(fields, field.name));

    expect(actual).toEqual(expected);
  });

  it('return AnyType by default like when a field cannot be found', () => {
    const expected = SObjectFieldType.AnyType;
    const actual = getType(fieldMap(sobjectMetadata), 'foo');

    expect(actual).toEqual(expected);
  });

  it('return AnyType when the describe type is unknown', () => {
    const fields = fieldMap({
      fields: [{ name: 'Weird', type: 'not-a-real-type', picklistValues: [] }]
    });

    expect(getType(fields, 'Weird')).toBe(SObjectFieldType.AnyType);
  });

  it('return a string list of picklist values', () => {
    const expected = [
      [],
      [],
      ['apple', 'banana', 'cherry'],
      [],
      [],
      [],
      ['apple', 'banana', 'cherry'],
      [],
      [],
      [],
      ['apple', 'banana', 'cherry'],
      []
    ];
    const fields = fieldMap(sobjectMetadata);
    const actual = sobjectMetadata.fields.map(field => getPicklistValues(fields, field.name));

    expect(actual).toEqual(expected);
  });

  it('return whether a field is nillable', () => {
    const fields = fieldMap({
      fields: [
        { name: 'Name', type: 'string', picklistValues: [], nillable: true },
        { name: 'Id', type: 'id', picklistValues: [], nillable: false }
      ]
    });

    expect(getNillable(fields, 'Name')).toBe(true);
    expect(getNillable(fields, 'Id')).toBe(false);
    expect(getNillable(fields, 'Missing')).toBeUndefined();
    expect(getNillable(undefined, 'Name')).toBeUndefined();
  });
});
