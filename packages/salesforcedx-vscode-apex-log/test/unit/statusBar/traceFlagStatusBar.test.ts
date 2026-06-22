/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TraceFlagItem } from 'salesforcedx-vscode-services';
import { selectCurrentUserFlag } from '../../../src/statusBar/traceFlagStatusBar';

const future = new Date(Date.now() + 60_000);

const makeFlag = (
  logType: TraceFlagItem['logType'],
  tracedEntityId: string,
  overrides: Partial<TraceFlagItem> = {}
): TraceFlagItem => ({
  id: `id-${logType}-${tracedEntityId}`,
  logType,
  tracedEntityId,
  expirationDate: future,
  isActive: true,
  ...overrides
});

const CURRENT_USER = '005CURRENT';
const OTHER_USER = '005OTHER';

describe('selectCurrentUserFlag', () => {
  it('returns undefined when records are empty', () => {
    expect(selectCurrentUserFlag([], CURRENT_USER)).toBeUndefined();
  });

  it('returns undefined when userId is undefined', () => {
    const flag = makeFlag('DEVELOPER_LOG', CURRENT_USER);
    expect(selectCurrentUserFlag([flag], undefined)).toBeUndefined();
  });

  it('returns the DEVELOPER_LOG flag for the current user', () => {
    const flag = makeFlag('DEVELOPER_LOG', CURRENT_USER);
    expect(selectCurrentUserFlag([flag], CURRENT_USER)).toBe(flag);
  });

  it('ignores DEVELOPER_LOG flags belonging to another user', () => {
    const otherFlag = makeFlag('DEVELOPER_LOG', OTHER_USER);
    expect(selectCurrentUserFlag([otherFlag], CURRENT_USER)).toBeUndefined();
  });

  it('ignores USER_DEBUG flags for the current user', () => {
    const userDebugFlag = makeFlag('USER_DEBUG', CURRENT_USER);
    expect(selectCurrentUserFlag([userDebugFlag], CURRENT_USER)).toBeUndefined();
  });

  it('returns current user DEVELOPER_LOG even when another user has one with a later expiry', () => {
    const currentFlag = makeFlag('DEVELOPER_LOG', CURRENT_USER, {
      expirationDate: new Date(Date.now() + 60_000)
    });
    const otherFlag = makeFlag('DEVELOPER_LOG', OTHER_USER, {
      expirationDate: new Date(Date.now() + 3_600_000)
    });
    // records sorted by expiry desc — other user's flag comes first
    expect(selectCurrentUserFlag([otherFlag, currentFlag], CURRENT_USER)).toBe(currentFlag);
  });

  it('returns undefined when current user only has USER_DEBUG flag and another user has DEVELOPER_LOG', () => {
    const currentUserDebug = makeFlag('USER_DEBUG', CURRENT_USER);
    const otherDevLog = makeFlag('DEVELOPER_LOG', OTHER_USER);
    expect(selectCurrentUserFlag([otherDevLog, currentUserDebug], CURRENT_USER)).toBeUndefined();
  });
});
