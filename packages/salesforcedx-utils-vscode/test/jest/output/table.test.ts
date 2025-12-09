/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { calculateMaxColumnWidths, Column, Row } from '../../../src/output/table';

describe('calculateMaxColumnWidths', () => {
  it('should calculate widths based on column labels', () => {
    const rows: Row[] = [
      { name: 'John', age: 30 },
      { name: 'Jane', age: 25 }
    ];
    const cols: Column[] = [
      { key: 'name', label: 'Full Name' },
      { key: 'age', label: 'Age' }
    ];

    const result = calculateMaxColumnWidths(rows, cols);

    expect(result.get('name')).toBe(9); // 'Full Name'.length
    expect(result.get('age')).toBe(3); // 'Age'.length
  });

  it('should calculate widths based on cell content when longer than label', () => {
    const rows: Row[] = [
      { name: 'Christopher', age: 30 },
      { name: 'Jane', age: 25 }
    ];
    const cols: Column[] = [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' }
    ];

    const result = calculateMaxColumnWidths(rows, cols);

    expect(result.get('name')).toBe(11); // 'Christopher'.length
    expect(result.get('age')).toBe(3); // 'Age'.length
  });

  it('should handle multiline cells by using longest line', () => {
    const rows: Row[] = [
      { name: 'John\nDoe', age: 30 },
      { name: 'Jane', age: 25 }
    ];
    const cols: Column[] = [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' }
    ];

    const result = calculateMaxColumnWidths(rows, cols);

    expect(result.get('name')).toBe(4); // max('John'.length, 'Doe'.length, 'Jane'.length, 'Name'.length)
    expect(result.get('age')).toBe(3); // 'Age'.length
  });

  it('should handle multiline cells with longer lines', () => {
    const rows: Row[] = [{ description: 'Short\nThis is a very long line\nMedium' }];
    const cols: Column[] = [{ key: 'description', label: 'Desc' }];

    const result = calculateMaxColumnWidths(rows, cols);

    expect(result.get('description')).toBe(24); // 'This is a very long line'.length
  });

  it('should use column key when label is not provided', () => {
    const rows: Row[] = [{ name: 'John', age: 30 }];
    const cols: Column[] = [
      { key: 'name', label: '' },
      { key: 'age', label: '' }
    ];

    const result = calculateMaxColumnWidths(rows, cols);

    expect(result.get('name')).toBe(4); // max('name'.length, 'John'.length)
    expect(result.get('age')).toBe(3); // 'age'.length
  });

  it('should handle boolean and number values', () => {
    const rows: Row[] = [{ active: true, count: 12_345 }];
    const cols: Column[] = [
      { key: 'active', label: 'Active' },
      { key: 'count', label: 'Count' }
    ];

    const result = calculateMaxColumnWidths(rows, cols);

    expect(result.get('active')).toBe(6); // 'Active'.length
    expect(result.get('count')).toBe(5); // '12345'.length (converted to string)
  });

  it('should handle multiple rows and find max width', () => {
    const rows: Row[] = [
      { name: 'Jo', age: 1 },
      { name: 'Jane', age: 25 },
      { name: 'Christopher', age: 100 }
    ];
    const cols: Column[] = [
      { key: 'name', label: 'N' },
      { key: 'age', label: 'A' }
    ];

    const result = calculateMaxColumnWidths(rows, cols);

    expect(result.get('name')).toBe(11); // 'Christopher'.length
    expect(result.get('age')).toBe(3); // '100'.length
  });
});
