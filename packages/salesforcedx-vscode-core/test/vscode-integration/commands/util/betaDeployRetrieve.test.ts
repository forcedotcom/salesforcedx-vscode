/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { expect } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import { createComponentCount } from '../../../../src/commands/util';
import {
  decomposed,
  matchingContentFile,
  mockRegistry,
  mockRegistryData
} from '../../mock/registry';

const env = createSandbox();

describe('Deploy/Retrieve Performance Beta Utils', () => {
  const testComponents = [
    matchingContentFile.COMPONENT,
    decomposed.DECOMPOSED_COMPONENT
  ];

  describe('createComponentCount', () => {
    it('should correctly generate rows for telemetry', () => {
      const { name: matchingName } = mockRegistryData.types.matchingcontentfile;
      const { name: decomposedName } = mockRegistryData.types.decomposed;
      const rows = createComponentCount(new ComponentSet(testComponents, mockRegistry));
      expect(rows).to.deep.equal([
        { type: matchingName, quantity: 1 },
        { type: decomposedName, quantity: 1 }
      ]);
    });
  });
});
