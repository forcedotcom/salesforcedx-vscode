/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { AuraWorkspaceContext } from '../../src/context/auraContext';

const attributeNames = ['z', 'ä'];

const standardComponents = vi.hoisted(() => ({
  'aura:test': {
    attributes: [{ name: 'z' }, { name: 'ä' }],
    description: '',
    namespace: 'aura',
    type: 'component'
  }
}));

vi.mock('../../src/resources/aura-standard.json', () => ({
  default: standardComponents,
  ...standardComponents
}));

import AuraIndexer from '../../src/aura-indexer/indexer';

it('sorts standard component attributes with locale-aware comparison', async () => {
  const context = {
    addIndexingProvider: vi.fn(),
    findAllAuraMarkup: vi.fn().mockResolvedValue([]),
    type: 'SFDX'
  } as unknown as AuraWorkspaceContext;
  const indexer = new AuraIndexer(context);

  await indexer.configureAndIndex();

  expect(indexer.getAuraByTag('aura:test')?.attributes.map(attribute => attribute.name)).toEqual(
    attributeNames.toSorted((left, right) => left.localeCompare(right))
  );
});
