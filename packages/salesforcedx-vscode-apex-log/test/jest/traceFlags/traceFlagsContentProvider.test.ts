/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DebugLevelItem, TraceFlagItem } from 'salesforcedx-vscode-services';
import { orphanLensTargets } from '../../../src/traceFlags/traceFlagsCodeLensProvider';
import { enrichTraceFlags, isOrphanedTraceFlag } from '../../../src/traceFlags/traceFlagsContentProvider';

const farFuture = new Date(Date.now() + 1000 * 60 * 60);

const makeFlag = (overrides: Partial<TraceFlagItem> = {}): TraceFlagItem => ({
  id: '7tf0Z000002m2ZCQAY',
  logType: 'DEVELOPER_LOG',
  expirationDate: farFuture,
  isActive: true,
  ...overrides
});

const makeDebugLevel = (id: string, developerName: string): DebugLevelItem =>
  ({ id, developerName, masterLabel: developerName }) as DebugLevelItem;

describe('enrichTraceFlags', () => {
  it('uses debugLevelName from the trace flag (relationship join) when present', () => {
    const flag = makeFlag({ debugLevelId: '7dl31000000GnNfAAK', debugLevelName: 'SFDC_DevConsole' });
    const { enriched, orphans } = enrichTraceFlags([flag], []);
    expect(enriched[0].debugLevelName).toBe('SFDC_DevConsole');
    expect(orphans).toHaveLength(0);
  });

  it('falls back to the debugLevels lookup when the join name is absent', () => {
    const flag = makeFlag({ debugLevelId: 'dl1' });
    const { enriched, orphans } = enrichTraceFlags([flag], [makeDebugLevel('dl1', 'MyLevel')]);
    expect(enriched[0].debugLevelName).toBe('MyLevel');
    expect(orphans).toHaveLength(0);
  });

  it('does not throw and reports an orphan when the debug level cannot be resolved (issue #7528)', () => {
    const flag = makeFlag({ debugLevelId: '7dl31000000GnNfAAK' });
    const { enriched, orphans } = enrichTraceFlags([flag], []);
    expect(enriched).toHaveLength(1);
    expect(enriched[0].debugLevelName).toBeUndefined();
    expect(orphans).toEqual([flag]);
  });

  it('leaves debugLevelName undefined for a flag with no debugLevelId, no orphan', () => {
    const flag = makeFlag({ debugLevelId: undefined });
    const { enriched, orphans } = enrichTraceFlags([flag], []);
    expect(enriched[0].debugLevelName).toBeUndefined();
    expect(orphans).toHaveLength(0);
  });

  it('renders resolvable flags even when another flag in the batch is orphaned', () => {
    const orphan = makeFlag({ id: 'orphan', debugLevelId: 'missing' });
    const ok = makeFlag({ id: 'ok', debugLevelId: 'dl1', debugLevelName: 'Resolved' });
    const { enriched, orphans } = enrichTraceFlags([orphan, ok], []);
    expect(enriched).toHaveLength(2);
    expect(enriched.find(f => f.id === 'ok')?.debugLevelName).toBe('Resolved');
    expect(enriched.find(f => f.id === 'orphan')?.debugLevelName).toBeUndefined();
    expect(orphans.map(o => o.id)).toEqual(['orphan']);
  });
});

describe('isOrphanedTraceFlag', () => {
  it('is true when debugLevelId is set but debugLevelName is unresolved', () => {
    expect(isOrphanedTraceFlag(makeFlag({ debugLevelId: '7dl31000000GnNfAAK' }))).toBe(true);
  });

  it('is false when the debug level resolved to a name', () => {
    expect(isOrphanedTraceFlag(makeFlag({ debugLevelId: 'dl1', debugLevelName: 'MyLevel' }))).toBe(false);
  });

  it('is false when the flag has no debugLevelId at all', () => {
    expect(isOrphanedTraceFlag(makeFlag({ debugLevelId: undefined }))).toBe(false);
  });
});

describe('orphanLensTargets', () => {
  it('returns one target per orphaned active flag, carrying its id and missing debugLevelId', () => {
    const orphan = makeFlag({ id: '7tfOrphan', debugLevelId: '7dlMissingAAA' });
    const healthy = makeFlag({ id: '7tfOk', debugLevelId: 'dl1', debugLevelName: 'Resolved' });
    const targets = orphanLensTargets([orphan, healthy]);
    expect(targets).toEqual([{ traceFlagId: '7tfOrphan', debugLevelId: '7dlMissingAAA' }]);
  });

  it('returns no targets when every flag resolved a debug level name', () => {
    const healthy = makeFlag({ id: '7tfOk', debugLevelId: 'dl1', debugLevelName: 'Resolved' });
    expect(orphanLensTargets([healthy])).toEqual([]);
  });

  it('ignores inactive flags even when orphaned', () => {
    const expiredOrphan = makeFlag({ id: '7tfExpired', debugLevelId: '7dlMissingAAA', isActive: false });
    expect(orphanLensTargets([expiredOrphan])).toEqual([]);
  });
});
