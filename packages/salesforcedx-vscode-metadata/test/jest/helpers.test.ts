/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { StatusOutputRow } from '@salesforce/source-tracking';
import { calculateCounts, dedupeStatus, separateChanges } from '../../src/statusBar/helpers';

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

  it('should handle 25,000 rows with dupes, ignores, and conflicts under 100ms', () => {
    const rows: StatusOutputRow[] = Array.from({ length: 25_000 }, (_, i) => {
      const ignored = i % 20 === 0;
      const conflict = !ignored && i % 50 === 0;
      const origin = i % 3 === 0 ? 'remote' : 'local';
      // reuse names to create duplicates (~5k unique names across 25k rows)
      const name = `Comp_${i % 5000}`;
      const type = TYPES[i % TYPES.length];
      return createStatusRow(name, type, { ignored, conflict, origin });
    });

    const start = performance.now();
    const result = dedupeStatus(rows);
    const elapsed = performance.now() - start;

    expect(result.every(r => !r.ignored)).toBe(true);
    // conflicts should win over non-conflict dupes
    const conflictRows = result.filter(r => r.conflict);
    expect(conflictRows.length).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(
      `dedupeStatus 25k rows: ${elapsed.toFixed(2)}ms → ${result.length} unique (${conflictRows.length} conflicts)`
    );
    expect(elapsed).toBeLessThan(100);
  });
});

const TYPES = ['ApexClass', 'ApexTrigger', 'LightningComponentBundle', 'CustomObject', 'Layout'] as const;

const generateRows = (count: number): StatusOutputRow[] =>
  Array.from({ length: count }, (_, i) => {
    const origin = i % 10 === 0 ? 'remote' : 'local';
    const conflict = i % 50 === 0;
    return createStatusRow(`Component_${i}`, TYPES[i % TYPES.length], { origin, conflict });
  });

describe('calculateCounts', () => {
  it('should count local, remote, and conflicts', () => {
    const status: StatusOutputRow[] = [
      createStatusRow('A', 'ApexClass', { origin: 'local' }),
      createStatusRow('B', 'ApexClass', { origin: 'remote' }),
      createStatusRow('C', 'ApexClass', { origin: 'local', conflict: true }),
      createStatusRow('D', 'ApexClass', { origin: 'remote' }),
      createStatusRow('E', 'ApexClass', { origin: 'local' })
    ];

    expect(calculateCounts(status)).toEqual({ local: 2, remote: 2, conflicts: 1 });
  });

  it('should handle 25,000 rows under 50ms', () => {
    const rows = generateRows(25_000);
    const start = performance.now();
    const counts = calculateCounts(rows);
    const elapsed = performance.now() - start;

    expect(counts.local + counts.remote + counts.conflicts).toBe(25_000);
    expect(counts.conflicts).toBe(500); // every 50th row
    expect(counts.remote).toBe(2000); // every 10th minus conflicts
    expect(counts.local).toBe(22_500);
    // eslint-disable-next-line no-console
    console.log(`calculateCounts 25k rows: ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeLessThan(50);
  });
});

describe('separateChanges', () => {
  it('should separate and sort changes', () => {
    const status: StatusOutputRow[] = [
      createStatusRow('Zebra', 'ApexClass', { origin: 'local' }),
      createStatusRow('Alpha', 'ApexClass', { origin: 'remote' }),
      createStatusRow('Middle', 'ApexClass', { origin: 'local', conflict: true }),
      createStatusRow('Beta', 'ApexTrigger', { origin: 'remote' })
    ];

    const result = separateChanges(status);

    expect(result.localChanges).toHaveLength(1);
    expect(result.localChanges[0].fullName).toBe('Zebra');
    expect(result.remoteChanges).toHaveLength(2);
    expect(result.remoteChanges.map(r => r.fullName)).toEqual(['Alpha', 'Beta']);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].fullName).toBe('Middle');
  });

  it('should handle 25,000 rows under 100ms', () => {
    const rows = generateRows(25_000);
    const start = performance.now();
    const result = separateChanges(rows);
    const elapsed = performance.now() - start;

    expect(result.localChanges.length + result.remoteChanges.length + result.conflicts.length).toBe(25_000);
    // eslint-disable-next-line no-console
    console.log(`separateChanges 25k rows: ${elapsed.toFixed(2)}ms`);
    expect(elapsed).toBeLessThan(100);
  });
});
