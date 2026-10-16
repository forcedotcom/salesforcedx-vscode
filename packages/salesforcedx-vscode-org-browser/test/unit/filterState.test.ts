/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getFilterState, saveFilterState } from '../../src/services/filterState';

describe('Org Browser filter state', () => {
  it('stores filters independently for each org', async () => {
    let state: Record<string, unknown> = {};
    const context = {
      workspaceState: {
        get: <T>(key: string): T | undefined => state[key] as T | undefined,
        update: async (key: string, value: unknown) => {
          state = { ...state, [key]: value };
        }
      }
    } as never;
    const orgOneFilter = {
      typeFilter: 'ApexClass',
      componentFilter: 'Broker',
      typeIsRegex: false,
      componentIsRegex: false,
      showLocal: true,
      showOrg: false
    };
    const orgTwoFilter = {
      typeFilter: undefined,
      componentFilter: 'Active Users',
      typeIsRegex: false,
      componentIsRegex: false,
      showLocal: false,
      showOrg: true
    };

    await saveFilterState(context, 'org-one', orgOneFilter);
    await saveFilterState(context, 'org-two', orgTwoFilter);

    expect(getFilterState(context, 'org-one')).toEqual(orgOneFilter);
    expect(getFilterState(context, 'org-two')).toEqual(orgTwoFilter);
    expect(getFilterState(context, 'org-three')).toBeUndefined();
  });

  it('merges visibility changes with the active org filter', async () => {
    let state: Record<string, unknown> = {};
    const context = {
      workspaceState: {
        get: <T>(key: string): T | undefined => state[key] as T | undefined,
        update: async (key: string, value: unknown) => {
          state = { ...state, [key]: value };
        }
      }
    } as never;

    await saveFilterState(context, 'org-one', { componentFilter: 'Broker', showOrg: false });
    await saveFilterState(context, 'org-one', { showLocal: false });

    expect(getFilterState(context, 'org-one')).toEqual({
      typeFilter: undefined,
      componentFilter: 'Broker',
      typeIsRegex: false,
      componentIsRegex: false,
      showLocal: false,
      showOrg: false
    });
  });
});
