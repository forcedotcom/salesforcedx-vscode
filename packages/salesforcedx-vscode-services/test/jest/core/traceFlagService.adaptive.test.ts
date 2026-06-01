/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Option from 'effect/Option';
import {
  ADAPTIVE_TTL_SEQUENCE_MS,
  adaptiveTtl,
  computeAdaptiveTtl,
  isSameTfArray,
  isSameTfOption,
  tfArrayHash,
  tfOptionHash
} from '../../../src/core/traceFlagService';
import type { TraceFlagItem } from '../../../src/core/schemas/traceFlagSchemas';

const makeItem = (overrides: Partial<TraceFlagItem> = {}): TraceFlagItem => ({
  id: 'tf-1',
  debugLevelId: 'dl-1',
  tracedEntityId: '005xxx',
  tracedEntityName: undefined,
  logType: 'DEVELOPER_LOG',
  startDate: undefined,
  expirationDate: new Date('2026-12-31T00:00:00.000Z'),
  isActive: true,
  ...overrides
});

describe('TraceFlagService — adaptive TTL', () => {
  describe('adaptiveTtl(n) — 30s → 60s → 120s → 300s cap', () => {
    it('returns 30s at count 0', () => {
      expect(Duration.toMillis(adaptiveTtl(0))).toBe(30_000);
    });
    it('returns 60s at count 1', () => {
      expect(Duration.toMillis(adaptiveTtl(1))).toBe(60_000);
    });
    it('returns 120s at count 2', () => {
      expect(Duration.toMillis(adaptiveTtl(2))).toBe(120_000);
    });
    it('returns 300s (5min cap) at count 3', () => {
      expect(Duration.toMillis(adaptiveTtl(3))).toBe(300_000);
    });
    it('stays at 300s for counts beyond the cap (4, 10, 100)', () => {
      expect(Duration.toMillis(adaptiveTtl(4))).toBe(300_000);
      expect(Duration.toMillis(adaptiveTtl(10))).toBe(300_000);
      expect(Duration.toMillis(adaptiveTtl(100))).toBe(300_000);
    });
    it('sequence matches the published table', () => {
      const sequence = [0, 1, 2, 3].map(n => Duration.toMillis(adaptiveTtl(n)));
      expect(sequence).toEqual([...ADAPTIVE_TTL_SEQUENCE_MS]);
    });
  });

  describe('stable identity hashes (defeats SOQL reordering)', () => {
    it('tfArrayHash is order-independent', () => {
      const a = makeItem({ id: 'A' });
      const b = makeItem({ id: 'B' });
      const c = makeItem({ id: 'C' });
      expect(tfArrayHash([a, b, c])).toBe(tfArrayHash([c, b, a]));
      expect(tfArrayHash([a, b])).not.toBe(tfArrayHash([a, b, c]));
    });
    it('tfArrayHash changes when expiration changes', () => {
      const t1 = makeItem({ expirationDate: new Date('2026-01-01T00:00:00.000Z') });
      const t2 = makeItem({ expirationDate: new Date('2026-02-01T00:00:00.000Z') });
      expect(tfArrayHash([t1])).not.toBe(tfArrayHash([t2]));
    });
    it('tfArrayHash changes when debugLevelId changes', () => {
      const t1 = makeItem({ debugLevelId: 'dl-1' });
      const t2 = makeItem({ debugLevelId: 'dl-2' });
      expect(tfArrayHash([t1])).not.toBe(tfArrayHash([t2]));
    });
    it('tfArrayHash changes when isActive changes', () => {
      const t1 = makeItem({ isActive: true });
      const t2 = makeItem({ isActive: false });
      expect(tfArrayHash([t1])).not.toBe(tfArrayHash([t2]));
    });
    it('tfOptionHash treats None and Some as different', () => {
      expect(tfOptionHash(Option.none())).toBe('');
      expect(tfOptionHash(Option.some(makeItem()))).not.toBe('');
    });
  });

  describe('isSameTfArray / isSameTfOption', () => {
    it('undefined prior → never same (so counter starts fresh at 0)', () => {
      expect(isSameTfArray(undefined, [makeItem()])).toBe(false);
      expect(isSameTfOption(undefined, Option.some(makeItem()))).toBe(false);
    });
    it('same content in different order → same', () => {
      const a = makeItem({ id: 'A' });
      const b = makeItem({ id: 'B' });
      expect(isSameTfArray([a, b], [b, a])).toBe(true);
    });
    it('Option.none vs Option.none → same', () => {
      expect(isSameTfOption(Option.none(), Option.none())).toBe(true);
    });
    it('Option.some(x) vs Option.some(x) → same', () => {
      expect(isSameTfOption(Option.some(makeItem({ id: 'X' })), Option.some(makeItem({ id: 'X' })))).toBe(true);
    });
    it('Option.none vs Option.some → different', () => {
      expect(isSameTfOption(Option.none(), Option.some(makeItem()))).toBe(false);
      expect(isSameTfOption(Option.some(makeItem()), Option.none())).toBe(false);
    });
  });

  describe('computeAdaptiveTtl — counter evolution', () => {
    it('first call (no prior) → count 0, TTL 30s', () => {
      const fresh = [makeItem()];
      const { newCount, ttl } = computeAdaptiveTtl(undefined, fresh, isSameTfArray);
      expect(newCount).toBe(0);
      expect(Duration.toMillis(ttl)).toBe(30_000);
    });

    it('escalates 30 → 60 → 120 → 300 on consecutive identical results', () => {
      const fresh = [makeItem({ id: 'tf-X' })];
      let prior: { lastResult: TraceFlagItem[]; consecutiveNoChange: number } | undefined;

      const results: number[] = [];
      for (let i = 0; i < 5; i++) {
        const { newCount, ttl } = computeAdaptiveTtl(prior, fresh, isSameTfArray);
        results.push(Duration.toMillis(ttl));
        prior = { lastResult: fresh, consecutiveNoChange: newCount };
      }
      // First call has no prior so counter = 0 (TTL 30s); subsequent 4 calls increment.
      expect(results).toEqual([30_000, 60_000, 120_000, 300_000, 300_000]);
    });

    it('different result resets counter back to 0 (TTL drops to 30s)', () => {
      const first = [makeItem({ id: 'A' })];
      const second = [makeItem({ id: 'B' })]; // semantically different

      // Prime to count=2 with `first`
      const prior = { lastResult: first, consecutiveNoChange: 2 };

      // Same content → counter would go to 3 → TTL=300s
      const sameNext = computeAdaptiveTtl(prior, first, isSameTfArray);
      expect(sameNext.newCount).toBe(3);
      expect(Duration.toMillis(sameNext.ttl)).toBe(300_000);

      // Change result → counter resets to 0 → TTL=30s
      const change = computeAdaptiveTtl(prior, second, isSameTfArray);
      expect(change.newCount).toBe(0);
      expect(Duration.toMillis(change.ttl)).toBe(30_000);
    });

    it('benign SOQL reorder still counts as same (order-independent compare)', () => {
      const a = makeItem({ id: 'A' });
      const b = makeItem({ id: 'B' });
      const c = makeItem({ id: 'C' });
      const original = [a, b, c];
      const reordered = [c, a, b]; // same data, different order — what SF can do without ORDER BY

      const prior = { lastResult: original, consecutiveNoChange: 2 };
      const { newCount, ttl } = computeAdaptiveTtl(prior, reordered, isSameTfArray);
      expect(newCount).toBe(3); // counter advances, NOT reset
      expect(Duration.toMillis(ttl)).toBe(300_000);
    });

    it('works for Option<TraceFlagItem> shape too', () => {
      const item = makeItem({ id: 'OPT' });
      const prior = { lastResult: Option.some(item), consecutiveNoChange: 1 };
      const result = computeAdaptiveTtl(prior, Option.some(makeItem({ id: 'OPT' })), isSameTfOption);
      expect(result.newCount).toBe(2);
      expect(Duration.toMillis(result.ttl)).toBe(120_000);
    });
  });
});
