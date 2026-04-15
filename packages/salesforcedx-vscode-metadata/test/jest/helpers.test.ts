/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { StatusOutputRow } from '@salesforce/source-tracking';
import { dedupeStatus } from '../../src/statusBar/helpers';

const createStatusRow = (
  fullName: string,
  type: string,
  options?: {
    ignored?: boolean;
    conflict?: boolean;
    origin?: 'local' | 'remote';
    state?: 'add' | 'delete' | 'modify' | 'nondelete';
    filePath?: string;
  }
): StatusOutputRow => ({
  fullName,
  type,
  filePath: options?.filePath ?? `force-app/main/default/${type}/${fullName}.cls`,
  ignored: options?.ignored ?? false,
  conflict: options?.conflict ?? false,
  origin: options?.origin ?? 'local',
  state: options?.state ?? 'modify'
});

describe('dedupeStatus', () => {
  it('should filter out ignored rows', () => {
    const status: StatusOutputRow[] = [
      createStatusRow('Test1', 'ApexClass'),
      createStatusRow('Test2', 'ApexClass', { ignored: true }),
      createStatusRow('Test3', 'ApexClass'),
      createStatusRow('Test4', 'ApexClass', { ignored: true })
    ];

    const result = dedupeStatus(status);

    expect(result).toHaveLength(2);
    expect(result.map(r => r.fullName)).toEqual(['Test1', 'Test3']);
    expect(result.every(r => !r.ignored)).toBe(true);
  });

  it('should prioritize conflicts first', () => {
    const status: StatusOutputRow[] = [
      createStatusRow('Test1', 'ApexClass'),
      createStatusRow('Test2', 'ApexClass', { conflict: true }),
      createStatusRow('Test3', 'ApexClass'),
      createStatusRow('Test4', 'ApexClass', { conflict: true })
    ];

    const result = dedupeStatus(status);

    expect(result).toHaveLength(4);
    expect(result[0].conflict).toBe(true);
    expect(result[1].conflict).toBe(true);
    expect(result[2].conflict).toBe(false);
    expect(result[3].conflict).toBe(false);
  });

  it('should deduplicate rows by fullName and type', () => {
    const status: StatusOutputRow[] = [
      createStatusRow('Test1', 'ApexClass'),
      createStatusRow('Test1', 'ApexClass'),
      createStatusRow('Test2', 'ApexClass'),
      createStatusRow('Test1', 'ApexClass', { conflict: true }),
      createStatusRow('Test1', 'ApexClass', { origin: 'remote' })
    ];

    const result = dedupeStatus(status);

    expect(result).toHaveLength(2);
    expect(result.map(r => `${r.fullName}:${r.type}`)).toEqual(['Test1:ApexClass', 'Test2:ApexClass']);
    expect(result[0].conflict).toBe(true);
  });

  it('should handle empty array', () => {
    const result = dedupeStatus([]);
    expect(result).toEqual([]);
  });

  it('should handle all ignored rows', () => {
    const status: StatusOutputRow[] = [
      createStatusRow('Test1', 'ApexClass', { ignored: true }),
      createStatusRow('Test2', 'ApexClass', { ignored: true })
    ];

    const result = dedupeStatus(status);
    expect(result).toEqual([]);
  });
});
