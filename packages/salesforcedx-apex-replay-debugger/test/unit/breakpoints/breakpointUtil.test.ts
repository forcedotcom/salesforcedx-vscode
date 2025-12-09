/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BreakpointUtil } from '../../../src/breakpoints';

describe('Breakpoint utilities', () => {
  let util: BreakpointUtil;

  it('Should not have line number mapping', () => {
    util = new BreakpointUtil();

    expect(util.getLineNumberMapping().size).toBe(0);
  });

  it('Should return line number mapping', () => {
    const lineNumberMapping: Map<string, number[]> = new Map([
      ['file:///foo.cls', [1, 2]],
      ['file:///bar.cls', [3, 4]]
    ]);
    const typerefMapping: Map<string, string> = new Map([
      ['foo', 'file:///foo.cls'],
      ['bar', 'file:///bar.cls']
    ]);
    util = new BreakpointUtil();

    util.setValidLines(lineNumberMapping, typerefMapping);

    expect(util.getLineNumberMapping()).toStrictEqual(lineNumberMapping);
    expect(util.getTyperefMapping()).toStrictEqual(typerefMapping);
  });

  it('Should verify line breakpoint', () => {
    const expectedMapping: Map<string, number[]> = new Map([['file:///foo.cls', [1]]]);
    util = new BreakpointUtil();

    util.setValidLines(expectedMapping, new Map());

    expect(util.canSetLineBreakpoint('file:///foo.cls', 1)).toBe(true);
    expect(util.canSetLineBreakpoint('file:///foo.cls', 2)).toBe(false);
    expect(util.canSetLineBreakpoint('file:///bar.cls', 1)).toBe(false);
  });

  it('Should return top level typeRef for URI', () => {
    const lineNumberMapping: Map<string, number[]> = new Map();
    const typerefMapping: Map<string, string> = new Map([
      ['YourClassName', 'file:///ClassWithNoNamespace.cls'],
      ['YourClassName$InnerClass', 'file:///ClassWithNoNamespace.cls'],
      ['YourClassName$InnerClass$InnerInnerClass', 'file:///ClassWithNoNamespace.cls'],
      ['YourNamespace/YourClassName$InnerClass$InnerInnerClass', 'file:///ClassWithNamespace.cls'],
      ['YourNamespace/YourClassName', 'file:///ClassWithNamespace.cls'],
      ['YourNamespace/YourClassName$InnerClass', 'file:///ClassWithNamespace.cls'],
      ['__sfdc_trigger/YourTriggerName$TriggerInnerClass', 'file:///triggerNoNamespace.trigger'],
      ['__sfdc_trigger/YourTriggerName', 'file:///triggerNoNamespace.trigger'],
      ['__sfdc_trigger/YourTriggerName$TriggerInnerClass$TriggerInnerInnerClass', 'file:///triggerNoNamespace.trigger'],
      ['__sfdc_trigger/Namespace/YourTriggerName/$InnerTriggerClass', 'file:///triggerWithNamespace.trigger'],
      [
        '__sfdc_trigger/Namespace/YourTriggerName/$InnerTriggerClass$TriggerInnerInnerClass',
        'file:///triggerWithNamespace.trigger'
      ],
      // It should be noted that the order of insertion is intentionally being mixed  up to ensure
      // that insertion order doesn't play any part in what is returned.
      ['__sfdc_trigger/Namespace/YourTriggerName', 'file:///triggerWithNamespace.trigger']
    ]);

    util = new BreakpointUtil();
    util.setValidLines(lineNumberMapping, typerefMapping);

    expect(util.getTopLevelTyperefForUri('file:///ClassWithNoNamespace.cls')).toBe('YourClassName');
    expect(util.getTopLevelTyperefForUri('file:///ClassWithNamespace.cls')).toBe('YourNamespace/YourClassName');
    expect(util.getTopLevelTyperefForUri('file:///triggerNoNamespace.trigger')).toBe('__sfdc_trigger/YourTriggerName');
    expect(util.getTopLevelTyperefForUri('file:///triggerWithNamespace.trigger')).toBe(
      '__sfdc_trigger/Namespace/YourTriggerName'
    );
  });
});
