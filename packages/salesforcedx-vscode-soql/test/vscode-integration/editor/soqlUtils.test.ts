/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { SoqlUtils, ToolingModelJson } from '../../../src/editor/soqlUtils';

describe('SoqlUtils', () => {
  const uiModelOne: ToolingModelJson = {
    sObject: 'Account',
    fields: ['Name', 'Id'],
    errors: [],
    unsupported: []
  };
  const soqlOne = 'Select Name, Id from Account';
  it('transform UI Model to Soql', () => {
    const transformedSoql = SoqlUtils.convertUiModelToSoql(uiModelOne);
    expect(transformedSoql).to.contain(uiModelOne.fields[0]);
    expect(transformedSoql).to.contain(uiModelOne.fields[1]);
    expect(transformedSoql).to.contain(uiModelOne.sObject);
  });
  it('transforms Soql to UI Model', () => {
    const transformedUiModel = SoqlUtils.convertSoqlToUiModel(soqlOne);
    expect(transformedUiModel).to.deep.equal(uiModelOne);
  });
});
