/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Soql } from '@salesforce/soql-model';
import { SObjectTypeUtils } from './sobjectUtils';

describe('SObjectTypeUtils should', () => {
  const sobjectMetadata = {
    fields: [
      { name: 'Id', type: 'id', picklistValues: [] },
      { name: 'Name', type: 'string', picklistValues: [] },
      {
        name: 'AccountSource',
        type: 'picklist',
        picklistValues: [
          { value: 'apple' },
          { value: 'banana' },
          { value: 'cherry' }
        ]
      },
      { name: 'AnnualRevenue', type: 'currency', picklistValues: [] },
      { name: 'BillingAddress', type: 'address', picklistValues: [] },
      { name: 'IsBuyer', type: 'boolean', picklistValues: [] },
      {
        name: 'CleanStatus',
        type: 'picklist',
        picklistValues: [
          { value: 'apple' },
          { value: 'banana' },
          { value: 'cherry' }
        ]
      },
      { name: 'CreatedById', type: 'reference', picklistValues: [] },
      { name: 'DandbCompanyId', type: 'reference', picklistValues: [] },
      { name: 'Jigsaw', type: 'string', picklistValues: [] },
      {
        name: 'Industry',
        type: 'picklist',
        picklistValues: [
          { value: 'apple' },
          { value: 'banana' },
          { value: 'cherry' }
        ]
      },
      { name: 'Phone', type: 'phone', picklistValues: [] }
    ]
  };

  it('return the type of a field found in an SObject', () => {
    const expected = [
      Soql.SObjectFieldType.Id,
      Soql.SObjectFieldType.String,
      Soql.SObjectFieldType.Picklist,
      Soql.SObjectFieldType.Currency,
      Soql.SObjectFieldType.Address,
      Soql.SObjectFieldType.Boolean,
      Soql.SObjectFieldType.Picklist,
      Soql.SObjectFieldType.Reference,
      Soql.SObjectFieldType.Reference,
      Soql.SObjectFieldType.String,
      Soql.SObjectFieldType.Picklist,
      Soql.SObjectFieldType.Phone
    ];
    const sobjectTypeUtils = new SObjectTypeUtils(sobjectMetadata);
    const actual = sobjectMetadata.fields.map((field) =>
      sobjectTypeUtils.getType(field.name)
    );

    expect(actual).toEqual(expected);
  });

  it('return AnyType by default like when a field cannot be found', () => {
    const expected = Soql.SObjectFieldType.AnyType;
    const actual = new SObjectTypeUtils(sobjectMetadata).getType('foo');

    expect(actual).toEqual(expected);
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
    const sobjectTypeUtils = new SObjectTypeUtils(sobjectMetadata);
    const actual = sobjectMetadata.fields.map((field) =>
      sobjectTypeUtils.getPicklistValues(field.name)
    );

    expect(actual).toEqual(expected);
  });
});
