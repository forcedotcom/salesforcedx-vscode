/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Column, createTable, Row } from '../../src/table';

// Find column boundaries by looking for separator pattern '  ' (2 spaces)
const findColumnStarts = (line: string): number[] => {
  const findNextStart = (pos: number): number | undefined => {
    const sepPos = line.indexOf('  ', pos);
    if (sepPos === -1) return undefined;
    // Skip past all consecutive spaces to find the start of the next column
    const afterSep = sepPos + 2;
    const nextNonSpace = line.slice(afterSep).split('').findIndex((char) => char !== ' ');
    const nextColStart = nextNonSpace === -1 ? line.length : afterSep + nextNonSpace;
    // Only return if there's actual content after the spaces (not just trailing spaces)
    return nextColStart < line.length && line[nextColStart] !== ' ' ? nextColStart : undefined;
  };
  
  const buildStarts = (currentPos: number, acc: number[]): number[] => {
    const nextStart = findNextStart(currentPos);
    return nextStart === undefined ? acc : buildStarts(nextStart, [...acc, nextStart]);
  };
  
  return buildStarts(0, [0]);
};

describe('createTable', () => {
  it('should create a simple table with 1 row and 3 columns', () => {
    const rows: Row[] = [{ name: 'Alice', age: 30, city: 'NYC' }];
    const cols: Column[] = [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' },
      { key: 'city', label: 'City' }
    ];

    const result = createTable(rows, cols);

    expect(result).toMatchSnapshot();
  });

  it('should create a table with multiple rows', () => {
    const rows: Row[] = [
      { name: 'Alice', age: 30, city: 'NYC' },
      { name: 'Bob', age: 25, city: 'LA' },
      { name: 'Charlie', age: 35, city: 'Chicago' }
    ];
    const cols: Column[] = [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' },
      { key: 'city', label: 'City' }
    ];

    const result = createTable(rows, cols);

    expect(result).toMatchSnapshot();
  });

  it('should handle empty first column (for emoji markers)', () => {
    const rows: Row[] = [
      { '': '', Type: 'Scratch', Alias: 'testOrg' },
      { '': '🍁', Type: 'Scratch', Alias: 'minimalTestOrg' }
    ];
    const cols: Column[] = [
      { key: '', label: '' },
      { key: 'Type', label: 'Type' },
      { key: 'Alias', label: 'Alias' }
    ];

    const result = createTable(rows, cols);

    expect(result).toMatchSnapshot();
  });

  it('should align columns correctly with emoji in first column', () => {
    const rows: Row[] = [
      { '': '', Type: 'Scratch', Alias: 'nonTrackingTestOrg', Username: 'test-ysyqxtqwtzfw@example.com' },
      { '': '🍁', Type: 'Scratch', Alias: 'minimalTestOrg', Username: 'test-kijlkuyegonk@example.com' },
      { '': '', Type: 'Scratch', Alias: '', Username: 'test-2fsq5vcdyifl@example.com' }
    ];
    const cols: Column[] = [
      { key: '', label: '' },
      { key: 'Type', label: 'Type' },
      { key: 'Alias', label: 'Alias' },
      { key: 'Username', label: 'Username' }
    ];

    const result = createTable(rows, cols);

    expect(result).toMatchSnapshot();
  });

  it('should handle table with title', () => {
    const rows: Row[] = [{ name: 'Alice', age: 30 }];
    const cols: Column[] = [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' }
    ];

    const result = createTable(rows, cols, 'Test Table');

    expect(result).toMatchSnapshot();
  });

  it('should handle empty cells', () => {
    const rows: Row[] = [
      { name: 'Alice', age: 30, city: 'NYC' },
      { name: 'Bob', age: 25, city: '' },
      { name: '', age: 35, city: 'Chicago' }
    ];
    const cols: Column[] = [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' },
      { key: 'city', label: 'City' }
    ];

    const result = createTable(rows, cols);

    expect(result).toMatchSnapshot();
  });

  it('should handle multiline cells', () => {
    const rows: Row[] = [
      { name: 'Alice\nSmith', age: 30, city: 'NYC' },
      { name: 'Bob', age: 25, city: 'LA' }
    ];
    const cols: Column[] = [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' },
      { key: 'city', label: 'City' }
    ];

    const result = createTable(rows, cols);

    expect(result).toMatchSnapshot();
  });

  it('should match org list table format', () => {
    const rows: Row[] = [
      {
        '': '',
        Type: 'Scratch',
        Alias: 'orgBrowserDreamhouseTestOrg',
        Username: 'test-zsnw86qj2ggg@example.com',
        'Org Id': '00DEc00000ZNoxdMAD',
        Status: 'Active',
        Expires: '2026-02-27'
      },
      {
        '': '🍁',
        Type: 'Scratch',
        Alias: 'minimalTestOrg',
        Username: 'test-kijlkuyegonk@example.com',
        'Org Id': '00DcU000005DSMzUAO',
        Status: 'Active',
        Expires: '2026-02-10'
      },
      {
        '': '',
        Type: 'Scratch',
        Alias: 'nonTrackingTestOrg',
        Username: 'test-ysyqxtqwtzfw@example.com',
        'Org Id': '00DEc00000YjpyJMAR',
        Status: 'Active',
        Expires: '2026-02-15'
      },
      {
        '': '',
        Type: 'Scratch',
        Alias: '',
        Username: 'test-2fsq5vcdyifl@example.com',
        'Org Id': '00DRt00000L6dnmMAB',
        Status: 'Active',
        Expires: '2026-02-13'
      }
    ];
    const cols: Column[] = [
      { key: '', label: '' },
      { key: 'Type', label: 'Type' },
      { key: 'Alias', label: 'Alias' },
      { key: 'Username', label: 'Username' },
      { key: 'Org Id', label: 'Org Id' },
      { key: 'Status', label: 'Status' },
      { key: 'Expires', label: 'Expires' }
    ];

    const result = createTable(rows, cols);
    const lines = result.split('\n');

    // Verify alignment: all rows should have second column starting at same position
    // Find where "Type" appears in header (second column)
    const headerTypePos = lines[0].indexOf('Type');

    // For separator, find where second column of dashes starts
    // The separator has dashes for each column, so find the first '  ' after dashes
    // Pattern: "──  ───────" - first column is "──", separator is "  ", second column starts after
    const separatorMatch = lines[1].match(/^([^ ]+)\s{2}/);
    const separatorFirstColWidth = separatorMatch ? separatorMatch[1].length : 0;
    const separatorSecondColStart = separatorFirstColWidth + 2; // column width + separator width

    // Header and separator should align - second column should start at same position
    expect(headerTypePos).toBe(separatorSecondColStart);

    // Data rows should also align - check where "Scratch" appears (second column content)
    const dataScratchPos = lines[2].indexOf('Scratch');
    expect(dataScratchPos).toBe(separatorSecondColStart);

    // Verify first column width: header first column should match separator first column width
    // Header first column ends where "Type" starts minus separator width
    const headerFirstColWidth = headerTypePos - 2; // position of Type minus separator width
    expect(headerFirstColWidth).toBe(separatorFirstColWidth);

    expect(result).toMatchSnapshot();
  });

  it('should have correct spacing before Type column (reproducing user issue)', () => {
    const rows: Row[] = [
      {
        '': '',
        Type: 'Scratch',
        Alias: '',
        Username: 'test-2fsq5vcdyifl@example.com',
        'Org Id': '00DRt00000L6dnmMAB',
        Status: 'Active',
        Expires: '2026-02-13'
      },
      {
        '': '🍁',
        Type: 'Scratch',
        Alias: 'minimalTestOrg',
        Username: 'test-kijlkuyegonk@example.com',
        'Org Id': '00DcU000005DSMzUAO',
        Status: 'Active',
        Expires: '2026-02-10'
      }
    ];
    const cols: Column[] = [
      { key: '', label: '' },
      { key: 'Type', label: 'Type' },
      { key: 'Alias', label: 'Alias' },
      { key: 'Username', label: 'Username' },
      { key: 'Org Id', label: 'Org Id' },
      { key: 'Status', label: 'Status' },
      { key: 'Expires', label: 'Expires' }
    ];

    const result = createTable(rows, cols);
    const lines = result.split('\n');

    // First column width should be 2 (emoji is 2 chars)
    // So header should have: 2 spaces (column) + 2 spaces (separator) = 4 spaces before "Type"
    const headerTypePos = lines[0].indexOf('Type');
    const charsBeforeType = lines[0].substring(0, headerTypePos);

    // Should be exactly 4 spaces (2 for column + 2 for separator)
    expect(charsBeforeType.length).toBe(4);
    expect(charsBeforeType).toBe('    ');

    // Separator should have: 2 dashes (column) + 2 spaces (separator) = 4 chars before second column
    const separatorMatch = lines[1].match(/^([─]+)\s{2}/);
    expect(separatorMatch).not.toBeNull();
    const separatorFirstColWidth = separatorMatch![1].length;
    expect(separatorFirstColWidth).toBe(2); // Should be 2 dashes

    const separatorSecondColStart = separatorFirstColWidth + 2; // 2 + 2 = 4
    expect(headerTypePos).toBe(separatorSecondColStart);
  });

  it('should match exact user output format', () => {
    const rows: Row[] = [
      {
        '': '',
        Type: 'Scratch',
        Alias: '',
        Username: 'test-2fsq5vcdyifl@example.com',
        'Org Id': '00DRt00000L6dnmMAB',
        Status: 'Active',
        Expires: '2026-02-13'
      },
      {
        '': '',
        Type: 'Scratch',
        Alias: 'nonTrackingTestOrg',
        Username: 'test-ysyqxtqwtzfw@example.com',
        'Org Id': '00DEc00000YjpyJMAR',
        Status: 'Active',
        Expires: '2026-02-15'
      },
      {
        '': '',
        Type: 'Scratch',
        Alias: 'orgBrowserDreamhouseTestOrg',
        Username: 'test-zsnw86qj2ggg@example.com',
        'Org Id': '00DEc00000ZNoxdMAD',
        Status: 'Active',
        Expires: '2026-02-27'
      },
      {
        '': '🍁',
        Type: 'Scratch',
        Alias: 'minimalTestOrg',
        Username: 'test-kijlkuyegonk@example.com',
        'Org Id': '00DcU000005DSMzUAO',
        Status: 'Active',
        Expires: '2026-02-10'
      }
    ];
    const cols: Column[] = [
      { key: '', label: '' },
      { key: 'Type', label: 'Type' },
      { key: 'Alias', label: 'Alias' },
      { key: 'Username', label: 'Username' },
      { key: 'Org Id', label: 'Org Id' },
      { key: 'Status', label: 'Status' },
      { key: 'Expires', label: 'Expires' }
    ];

    const result = createTable(rows, cols);
    const lines = result.split('\n');

    // Verify header: should have 4 spaces before "Type" (2 for column + 2 for separator)
    const headerTypePos = lines[0].indexOf('Type');
    expect(headerTypePos).toBe(4);
    expect(lines[0].substring(0, headerTypePos)).toBe('    ');

    // Verify separator: should have 2 dashes, then 2 spaces, then 7 dashes for "Type"
    const separatorLine = lines[1];
    expect(separatorLine.substring(0, 2)).toBe('──'); // First column: 2 dashes
    expect(separatorLine.substring(2, 4)).toBe('  '); // Separator: 2 spaces
    expect(separatorLine.substring(4, 11)).toBe('───────'); // Second column: 7 dashes

    // Verify data rows align with header (skip trailing empty line)
    lines
      .slice(2)
      .filter(line => line.length > 0)
      .forEach(line => {
        const scratchPos = line.indexOf('Scratch');
        expect(scratchPos).toBe(4); // Should align with "Type" at position 4
      });
  });

  it('should have headers left-aligned within their columns (not drifting right)', () => {
    const rows: Row[] = [
      {
        '': '',
        Type: 'Scratch',
        Alias: 'orgBrowserDreamhouseTestOrg',
        Username: 'test-zsnw86qj2ggg@example.com',
        'Org Id': '00DEc00000ZNoxdMAD',
        Status: 'Active',
        Expires: '2026-02-27'
      },
      {
        '': '🍁',
        Type: 'Scratch',
        Alias: 'minimalTestOrg',
        Username: 'test-kijlkuyegonk@example.com',
        'Org Id': '00DcU000005DSMzUAO',
        Status: 'Active',
        Expires: '2026-02-10'
      },
      {
        '': '',
        Type: 'Scratch',
        Alias: 'nonTrackingTestOrg',
        Username: 'test-ysyqxtqwtzfw@example.com',
        'Org Id': '00DEc00000YjpyJMAR',
        Status: 'Active',
        Expires: '2026-02-15'
      },
      {
        '': '',
        Type: 'Scratch',
        Alias: '',
        Username: 'test-2fsq5vcdyifl@example.com',
        'Org Id': '00DRt00000L6dnmMAB',
        Status: 'Active',
        Expires: '2026-02-13'
      }
    ];
    const cols: Column[] = [
      { key: '', label: '' },
      { key: 'Type', label: 'Type' },
      { key: 'Alias', label: 'Alias' },
      { key: 'Username', label: 'Username' },
      { key: 'Org Id', label: 'Org Id' },
      { key: 'Status', label: 'Status' },
      { key: 'Expires', label: 'Expires' }
    ];

    const result = createTable(rows, cols);
    const lines = result.split('\n');
    const header = lines[0];
    const separator = lines[1];
    const dataRow = lines[2];

    // Parse columns by splitting on separator and checking alignment
    // Each column should start at the same position in header, separator, and data rows

    const headerStarts = findColumnStarts(header);
    const separatorStarts = findColumnStarts(separator);
    const dataStarts = findColumnStarts(dataRow);

    // All rows should have columns starting at the same positions
    expect(headerStarts.length).toBe(separatorStarts.length);
    expect(headerStarts.length).toBe(dataStarts.length);

    headerStarts.forEach((start, i) => {
      expect(separatorStarts[i]).toBe(start);
      expect(dataStarts[i]).toBe(start);
    });

    // Verify header text starts immediately at column start (left-aligned)
    expect(header.substring(headerStarts[1], headerStarts[1] + 4)).toBe('Type');
    expect(header.substring(headerStarts[2], headerStarts[2] + 5)).toBe('Alias');
    expect(header.substring(headerStarts[3], headerStarts[3] + 8)).toBe('Username');
  });
});
