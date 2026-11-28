/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { buildTraceFlagsSchemas } from '../../../src/schemas/traceFlagsSchema';

describe('trace flags JSON schema', () => {
  it('decodes the shared V2 TraceFlagItemStruct in the local Effect runtime', () => {
    const expiresAt = '2026-11-05T14:47:36.000Z';
    const { decodeTraceFlagsConfigFromJson } = buildTraceFlagsSchemas();
    const decoded = decodeTraceFlagsConfigFromJson(
      JSON.stringify({
        traceFlags: {
          DEVELOPER_LOG: [
            {
              id: '7tf000000000001AAA',
              debugLevelId: '7dl000000000001AAA',
              debugLevelName: 'ReplayDebuggerLevels',
              logType: 'DEVELOPER_LOG',
              expirationDate: expiresAt,
              isActive: true
            }
          ]
        },
        debugLevels: []
      })
    );

    expect(decoded?.traceFlags?.DEVELOPER_LOG?.[0]?.expirationDate).toEqual(new Date(expiresAt));
  });
});
