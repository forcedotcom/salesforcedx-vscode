/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { toTableFn } from '../../../src/queryDataView/dataProviders/csvDataProvider';

describe('toTableFn', () => {
  it('handles a simple flat SOQL query', () => {
    const query = 'SELECT Name, Age FROM Person';
    const data = [
      { Name: 'Alice', Age: 30 },
      { Name: 'Bob', Age: 25 }
    ];
    const result = toTableFn(query, data);
    expect(result.fields).toEqual(['Name', 'Age']);
    expect(result.data).toEqual([
      ['Alice', '30'],
      ['Bob', '25']
    ]);
  });

  it('handles missing fields in data', () => {
    const query = 'SELECT Name, Age FROM Person';
    const data = [{ Name: 'Charlie' }];
    const result = toTableFn(query, data);
    expect(result.fields).toEqual(['Name', 'Age']);
    expect(result.data).toEqual([['Charlie', '']]);
  });

  it('handles nested subquery', () => {
    const query = 'SELECT Name, (SELECT PetName FROM Pets) FROM Person';
    const data = [
      {
        Name: 'Dana',
        Pets: {
          records: [{ PetName: 'Fido' }, { PetName: 'Whiskers' }]
        }
      }
    ];
    const result = toTableFn(query, data);
    expect(result.fields).toEqual(['Name', 'Pets.PetName']);
    expect(result.data).toEqual([
      ['Dana', 'Fido'],
      ['Dana', 'Whiskers']
    ]);
  });

  it('handles empty data', () => {
    const query = 'SELECT Name FROM Person';
    const data = [];
    const result = toTableFn(query, data);
    expect(result.fields).toEqual(['Name']);
    expect(result.data).toEqual([]);
  });

  it('handles 3rd level nested subquery', () => {
    // TODO: this is a test that reflects the code as is, not as is should be.
    // WI to really fix it:
    const query = 'SELECT Name, (SELECT PetName, (SELECT ToyName FROM Toys) FROM Pets) FROM Person';
    const data = [
      {
        Name: 'Dana',
        Pets: {
          records: [
            {
              PetName: 'Fido',
              Toys: {
                records: [{ ToyName: 'Ball' }, { ToyName: 'Bone' }]
              }
            },
            {
              PetName: 'Whiskers',
              Toys: {
                records: [{ ToyName: 'Yarn' }]
              }
            }
          ]
        }
      }
    ];
    const result = toTableFn(query, data);
    expect(result.fields).toEqual(['Name', 'Pets.PetName', 'Toys.ToyName']);
    expect(result.data).toEqual([
      ['Dana', 'Fido'],
      ['Dana', 'Whiskers']
    ]);
  });
});
