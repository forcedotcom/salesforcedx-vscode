/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  canSetLineBreakpoint,
  createBreakpointMappings,
  emptyBreakpointMappings,
  getTopLevelTyperefForUri
} from '../../../src/breakpoints';

describe('Breakpoint utilities', () => {
  it('starts without mappings', () => {
    expect(emptyBreakpointMappings().lineNumbers.size).toBe(0);
  });

  it('creates line number and typeref mappings', () => {
    const mappings = createBreakpointMappings([
      { uri: 'file:///foo.cls', typeref: 'foo', lines: [1, 2] },
      { uri: 'file:///bar.cls', typeref: 'bar', lines: [3, 4] }
    ]);

    expect(mappings.lineNumbers).toStrictEqual(
      new Map([
        ['file:///foo.cls', [1, 2]],
        ['file:///bar.cls', [3, 4]]
      ])
    );
    expect(mappings.typerefs).toStrictEqual(
      new Map([
        ['foo', 'file:///foo.cls'],
        ['bar', 'file:///bar.cls']
      ])
    );
  });

  it('verifies mapped source lines', () => {
    const mappings = createBreakpointMappings([{ uri: 'file:///foo.cls', typeref: 'foo', lines: [1] }]);

    expect(canSetLineBreakpoint(mappings, 'file:///foo.cls', 1)).toBe(true);
    expect(canSetLineBreakpoint(mappings, 'file:///foo.cls', 2)).toBe(false);
    expect(canSetLineBreakpoint(mappings, 'file:///bar.cls', 1)).toBe(false);
  });

  it('returns the top-level typeref for a URI', () => {
    const mappings = createBreakpointMappings([
      { uri: 'file:///Class.cls', typeref: 'YourClassName$InnerClass', lines: [] },
      { uri: 'file:///Class.cls', typeref: 'YourClassName', lines: [] },
      { uri: 'file:///Trigger.trigger', typeref: '__sfdc_trigger/Namespace/YourTriggerName$Inner', lines: [] },
      { uri: 'file:///Trigger.trigger', typeref: '__sfdc_trigger/Namespace/YourTriggerName', lines: [] }
    ]);

    expect(getTopLevelTyperefForUri(mappings, 'file:///Class.cls')).toBe('YourClassName');
    expect(getTopLevelTyperefForUri(mappings, 'file:///Trigger.trigger')).toBe(
      '__sfdc_trigger/Namespace/YourTriggerName'
    );
  });
});
