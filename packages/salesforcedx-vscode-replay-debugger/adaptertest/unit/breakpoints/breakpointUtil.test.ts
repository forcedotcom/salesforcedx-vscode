/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { BreakpointUtil } from '../../../src/breakpoints';

// tslint:disable:no-unused-expression
describe('Breakpoint utilities', () => {
  let util: BreakpointUtil;

  it('Should not have line number mapping', () => {
    util = new BreakpointUtil();

    expect(util.hasLineNumberMapping()).to.be.false;
  });

  it('Should return line number mapping', () => {
    const lineNumberMapping: Map<string, number[]> = new Map();
    lineNumberMapping.set('file:///foo.cls', [1, 2]);
    lineNumberMapping.set('file:///bar.cls', [3, 4]);
    const typerefMapping: Map<string, string> = new Map();
    typerefMapping.set('foo', 'file:///foo.cls');
    typerefMapping.set('bar', 'file:///bar.cls');
    util = new BreakpointUtil();

    util.setValidLines(lineNumberMapping, typerefMapping);

    expect(util.hasLineNumberMapping()).to.be.true;
    expect(util.getLineNumberMapping()).to.deep.equal(lineNumberMapping);
    expect(util.getTyperefMapping()).to.deep.equal(typerefMapping);
  });

  it('Should verify line breakpoint', () => {
    const expectedMapping: Map<string, number[]> = new Map();
    expectedMapping.set('file:///foo.cls', [1]);
    util = new BreakpointUtil();

    util.setValidLines(expectedMapping, new Map());

    expect(util.canSetLineBreakpoint('file:///foo.cls', 1)).to.be.true;
    expect(util.canSetLineBreakpoint('file:///foo.cls', 2)).to.be.false;
    expect(util.canSetLineBreakpoint('file:///bar.cls', 1)).to.be.false;
  });

  it('Should return top level typeRef for URI', () => {
    const lineNumberMapping: Map<string, number[]> = new Map();
    const typerefMapping: Map<string, string> = new Map();
    // It should be noted that the order of insertion is intentionally being mixed  up to ensure
    // that insertion order doesn't play any part in what is returned.
    typerefMapping.set('YourClassName', 'file:///ClassWithNoNamespace.cls');
    typerefMapping.set(
      'YourClassName$InnerClass',
      'file:///ClassWithNoNamespace.cls'
    );
    typerefMapping.set(
      'YourClassName$InnerClass$InnerInnerClass',
      'file:///ClassWithNoNamespace.cls'
    );
    typerefMapping.set(
      'YourNamespace/YourClassName$InnerClass$InnerInnerClass',
      'file:///ClassWithNamespace.cls'
    );
    typerefMapping.set(
      'YourNamespace/YourClassName',
      'file:///ClassWithNamespace.cls'
    );
    typerefMapping.set(
      'YourNamespace/YourClassName$InnerClass',
      'file:///ClassWithNamespace.cls'
    );
    typerefMapping.set(
      '__sfdc_trigger/YourTriggerName$TriggerInnerClass',
      'file:///triggerNoNamespace.trigger'
    );
    typerefMapping.set(
      '__sfdc_trigger/YourTriggerName',
      'file:///triggerNoNamespace.trigger'
    );
    typerefMapping.set(
      '__sfdc_trigger/YourTriggerName$TriggerInnerClass$TriggerInnerInnerClass',
      'file:///triggerNoNamespace.trigger'
    );
    typerefMapping.set(
      '__sfdc_trigger/Namespace/YourTriggerName/$InnerTriggerClass',
      'file:///triggerWithNamespace.trigger'
    );
    typerefMapping.set(
      '__sfdc_trigger/Namespace/YourTriggerName/$InnerTriggerClass$TriggerInnerInnerClass',
      'file:///triggerWithNamespace.trigger'
    );
    typerefMapping.set(
      '__sfdc_trigger/Namespace/YourTriggerName',
      'file:///triggerWithNamespace.trigger'
    );

    util = new BreakpointUtil();
    util.setValidLines(lineNumberMapping, typerefMapping);

    expect(
      util.getTopLevelTyperefForUri('file:///ClassWithNoNamespace.cls')
    ).to.be.equal('YourClassName');
    expect(
      util.getTopLevelTyperefForUri('file:///ClassWithNamespace.cls')
    ).to.be.equal('YourNamespace/YourClassName');
    expect(
      util.getTopLevelTyperefForUri('file:///triggerNoNamespace.trigger')
    ).to.be.equal('__sfdc_trigger/YourTriggerName');
    expect(
      util.getTopLevelTyperefForUri('file:///triggerWithNamespace.trigger')
    ).to.be.equal('__sfdc_trigger/Namespace/YourTriggerName');
  });
});
