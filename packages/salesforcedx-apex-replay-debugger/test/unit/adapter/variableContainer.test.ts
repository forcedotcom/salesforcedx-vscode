/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApexVariableContainer } from '../../../src/adapter/variableContainer';

describe('ApexVariableContainer', () => {
  describe('getAllVariables', () => {
    it('sorts variables with `this` first, then alphabetically, case-insensitively, with natural numeric ordering', () => {
      const names = ['Zebra', 'apple', 'item10', 'item2', 'Banana'];
      const variables = new Map(names.map(name => [name, new ApexVariableContainer(name, 'value', 'String')]));
      const container = new ApexVariableContainer('', '', '', undefined, 0, variables);

      expect(container.getAllVariables().map(v => v.name)).toEqual(['apple', 'Banana', 'item2', 'item10', 'Zebra']);
    });

    it('places `this` variable first regardless of alphabetical order', () => {
      const names = ['Zebra', 'this', 'apple', 'item2'];
      const variables = new Map(names.map(name => [name, new ApexVariableContainer(name, 'value', 'String')]));
      const container = new ApexVariableContainer('', '', '', undefined, 0, variables);

      expect(container.getAllVariables().map(v => v.name)).toEqual(['this', 'apple', 'item2', 'Zebra']);
    });
  });
});
