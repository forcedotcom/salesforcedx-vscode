/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { convertToCSV } from '../../../src/commands/dataQuery';
import { CsvDataProvider } from '../../../src/queryDataView/dataProviders/csvDataProvider';

describe('CsvDataProvider', () => {
  it('delegates CSV export to convertToCSV', () => {
    const provider = new CsvDataProvider('q');
    const csv = provider.getFileContent('SELECT Name FROM X', [
      { Name: 'A' },
      { Name: 'B' }
    ] as unknown as import('@salesforce/ts-types').JsonMap[]);
    expect(csv).toBe('Name\nA\nB');
  });
});

describe('convertToCSV (Query Data View / SOQL Builder save)', () => {
  it('handles a simple flat SOQL-shaped result', () => {
    const data = [
      { Name: 'Alice', Age: 30 },
      { Name: 'Bob', Age: 25 }
    ];
    expect(convertToCSV(data)).toBe('Name,Age\nAlice,30\nBob,25');
  });

  it('preserves column order from field discovery and leaves missing cells empty', () => {
    const data = [{ Name: 'Charlie' }, { Name: 'Dee', Age: 40 }];
    expect(convertToCSV(data)).toBe('Name,Age\nCharlie,\nDee,40');
  });

  it('handles subquery envelope with totalSize/done/records', () => {
    const data = [
      {
        Name: 'Dana',
        Pets: {
          totalSize: 2,
          done: true,
          records: [{ PetName: 'Fido' }, { PetName: 'Whiskers' }]
        }
      }
    ];
    // CSV repeats parent columns on sub-query overflow rows (fully denormalized export)
    expect(convertToCSV(data)).toBe('Name,Pets.PetName\nDana,Fido\nDana,Whiskers');
  });

  it('returns empty string for empty data', () => {
    expect(convertToCSV([])).toBe('');
  });

  it('flattens nested sub-query rows into dotted columns', () => {
    const data = [
      {
        Name: 'Dana',
        Pets: {
          totalSize: 2,
          done: true,
          records: [
            {
              PetName: 'Fido',
              Toys: {
                totalSize: 2,
                done: true,
                records: [{ ToyName: 'Ball' }, { ToyName: 'Bone' }]
              }
            },
            {
              PetName: 'Whiskers',
              Toys: {
                totalSize: 1,
                done: true,
                records: [{ ToyName: 'Yarn' }]
              }
            }
          ]
        }
      }
    ];
    const csv = convertToCSV(data);
    expect(csv.startsWith('Name,Pets.PetName,Pets.Toys.ToyName\n')).toBe(true);
    expect(csv).toContain('Dana');
    expect(csv).toContain('Fido');
    expect(csv).toContain('Whiskers');
    expect(csv).toContain('Ball');
    expect(csv).toContain('Bone');
    expect(csv).toContain('Yarn');
  });
});
