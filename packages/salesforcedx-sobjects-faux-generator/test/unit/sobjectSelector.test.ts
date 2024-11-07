/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { GeneralSObjectSelector } from '../../src/transformer/transformerFactory';
import { SObjectCategory, SObjectRefreshSource } from '../../src/types';

const SOBJECTS_DESCRIBE_SAMPLE = {
  sobjects: [
    { custom: true, name: 'MyCustomObj1' },
    { custom: true, name: 'MyCustomObj2' },
    { custom: true, name: 'Custom_History_Obj' },
    { custom: true, name: 'MyCustomObj1Share' },
    { custom: true, name: 'MyCustomObj2History' },
    { custom: true, name: 'MyCustomObj1Feed' },
    { custom: true, name: 'MyCustomObj2Event' },
    { custom: false, name: 'Account' },
    { custom: false, name: 'Contact' },
    { custom: false, name: 'Lead' },
    { custom: false, name: 'LeadHistory' },
    { custom: false, name: 'Event' }
  ]
};

describe('Select sObjects', () => {
  it('Should return only custom sobjects for MANUAL', () => {
    const selector = new GeneralSObjectSelector(SObjectCategory.CUSTOM, SObjectRefreshSource.Manual);

    const results = SOBJECTS_DESCRIBE_SAMPLE.sobjects.filter(s => selector.select(s));

    expect(results.length).to.eql(3);
    expect(results).to.deep.equal([
      { custom: true, name: 'MyCustomObj1' },
      { custom: true, name: 'MyCustomObj2' },
      { custom: true, name: 'Custom_History_Obj' }
    ]);
  });

  it('Should return only standard sobjects for MANUAL', () => {
    const selector = new GeneralSObjectSelector(SObjectCategory.STANDARD, SObjectRefreshSource.Manual);

    const results = SOBJECTS_DESCRIBE_SAMPLE.sobjects.filter(s => selector.select(s));

    expect(results.length).to.eql(4);
    expect(results).to.deep.equal([
      { custom: false, name: 'Account' },
      { custom: false, name: 'Contact' },
      { custom: false, name: 'Lead' },
      { custom: false, name: 'Event' }
    ]);
  });

  it('Should filter out sobjects if category is CUSTOM & source MANUAL', () => {
    const selector = new GeneralSObjectSelector(SObjectCategory.CUSTOM, SObjectRefreshSource.Manual);

    const results = SOBJECTS_DESCRIBE_SAMPLE.sobjects.filter(s => selector.select(s));

    expect(results.length).to.eql(3);
    expect(results).to.deep.equal([
      { custom: true, name: 'MyCustomObj1' },
      { custom: true, name: 'MyCustomObj2' },
      { custom: true, name: 'Custom_History_Obj' }
    ]);
  });

  it('Should filter out sobjects if category is STANDARD & source MANUAL', () => {
    const selector = new GeneralSObjectSelector(SObjectCategory.STANDARD, SObjectRefreshSource.Manual);

    const results = SOBJECTS_DESCRIBE_SAMPLE.sobjects.filter(s => selector.select(s));

    expect(results.length).to.eql(4);
    expect(results).to.deep.equal([
      { custom: false, name: 'Account' },
      { custom: false, name: 'Contact' },
      { custom: false, name: 'Lead' },
      { custom: false, name: 'Event' }
    ]);
  });

  it('Should filter out associated sobjects if category is ALL & source is Startup', () => {
    const selector = new GeneralSObjectSelector(SObjectCategory.ALL, SObjectRefreshSource.Startup);

    const results = SOBJECTS_DESCRIBE_SAMPLE.sobjects.filter(s => selector.select(s));

    expect(results.length).to.eql(7);
    expect(results).to.deep.equal([
      { custom: true, name: 'MyCustomObj1' },
      { custom: true, name: 'MyCustomObj2' },
      { custom: true, name: 'Custom_History_Obj' },
      { custom: false, name: 'Account' },
      { custom: false, name: 'Contact' },
      { custom: false, name: 'Lead' },
      { custom: false, name: 'Event' }
    ]);
  });

  it('Should filter out sobjects if category is ALL & source is StartupMin', () => {
    const selector = new GeneralSObjectSelector(SObjectCategory.ALL, SObjectRefreshSource.Startup);

    const results = SOBJECTS_DESCRIBE_SAMPLE.sobjects.filter(s => selector.select(s));

    expect(results.length).to.eql(7);
    expect(results).to.deep.equal([
      { custom: true, name: 'MyCustomObj1' },
      { custom: true, name: 'MyCustomObj2' },
      { custom: true, name: 'Custom_History_Obj' },
      { custom: false, name: 'Account' },
      { custom: false, name: 'Contact' },
      { custom: false, name: 'Lead' },
      { custom: false, name: 'Event' }
    ]);
  });
});
